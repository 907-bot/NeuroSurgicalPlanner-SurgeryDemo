#!/usr/bin/env python3
"""
scripts/train_snn.py
Local Spiking Neural Network (SNN) training for intraoperative physiology simulation.

Optimized for Apple Silicon (MPS / CPU) and SpikingJelly:
- Multi-step activation-based LIF neurons with ATan surrogate gradients
- Backpropagation Through Time (BPTT) with state resets
- Multi-channel physiological vital signs (BP, HR, SpO2, ICP, CBF)
- Fast local training and checkpoint evaluation
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple

os.environ["MPLCONFIGDIR"] = "/tmp/matplotlib_cache"
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from loguru import logger
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from spikingjelly.activation_based import neuron, layer, functional, surrogate

from src.simulation.snn_physiology import (
    PHYSIO_CHANNELS,
    N_CHANNELS,
    NORMAL_RANGES,
)


class SyntheticPhysiologyDataset(Dataset):
    """
    Generates realistic synthetic intraoperative time-series sequences:
    - Normal baseline fluctuations
    - ICP spikes (mass effect / edema)
    - Hemorrhagic events (BP drop, HR rise)
    - Hypoxia (SpO2 drops)
    """

    def __init__(self, n_sequences: int = 200, seq_len: int = 32, seed: int = 42):
        np.random.seed(seed)
        self.sequences = []
        self.labels = []

        for _ in range(n_sequences):
            # Determine scenario
            scenario = np.random.choice(["stable", "icp_spike", "hemorrhage", "hypoxia"], p=[0.4, 0.25, 0.2, 0.15])
            seq = np.zeros((seq_len, N_CHANNELS), dtype=np.float32)

            # Baseline vitals
            bp_sys = np.random.uniform(110, 130)
            bp_dia = np.random.uniform(70, 85)
            hr = np.random.uniform(65, 85)
            spo2 = np.random.uniform(97, 100)
            icp = np.random.uniform(8, 14)
            cbf = np.random.uniform(45, 65)
            eto2 = np.random.uniform(30, 40)
            etco2 = np.random.uniform(35, 42)

            for t in range(seq_len):
                # Add drift and noise
                noise = np.random.normal(0, 0.5, N_CHANNELS)
                
                if scenario == "icp_spike" and t > seq_len // 2:
                    icp += np.random.uniform(0.5, 1.5)  # Rising intracranial pressure
                    cbf -= np.random.uniform(0.3, 0.8)  # Cerebral perfusion drops
                elif scenario == "hemorrhage" and t > seq_len // 2:
                    bp_sys -= np.random.uniform(0.8, 1.8)
                    bp_dia -= np.random.uniform(0.5, 1.2)
                    hr += np.random.uniform(0.8, 2.0)
                elif scenario == "hypoxia" and t > seq_len // 2:
                    spo2 -= np.random.uniform(0.5, 1.5)

                raw_vals = [bp_sys, bp_dia, hr, spo2, icp, cbf, eto2, etco2]
                norm_vals = []
                for i, ch in enumerate(PHYSIO_CHANNELS):
                    lo, hi = NORMAL_RANGES[ch]
                    val = np.clip((raw_vals[i] + noise[i] - lo) / (hi - lo), 0.0, 1.0)
                    norm_vals.append(val)

                seq[t] = norm_vals

            # Recovery score: 1.0 (perfect) to 0.0 (critical failure)
            if scenario == "stable":
                recovery = np.random.uniform(0.85, 0.98)
            elif scenario == "icp_spike":
                recovery = np.random.uniform(0.50, 0.70)
            elif scenario == "hemorrhage":
                recovery = np.random.uniform(0.40, 0.65)
            else:
                recovery = np.random.uniform(0.30, 0.55)

            self.sequences.append(seq)
            self.labels.append(recovery)

        self.sequences = torch.tensor(np.array(self.sequences), dtype=torch.float32)
        self.labels = torch.tensor(np.array(self.labels), dtype=torch.float32).unsqueeze(-1)

    def __len__(self):
        return len(self.sequences)

    def __getitem__(self, idx):
        # SpikingJelly expects input format: (T, N_CHANNELS)
        return self.sequences[idx], self.labels[idx]


class SurrogateHeaviside(torch.autograd.Function):
    @staticmethod
    def forward(ctx, x, alpha=2.0):
        ctx.save_for_backward(x)
        ctx.alpha = alpha
        return (x >= 0.0).float()

    @staticmethod
    def backward(ctx, grad_output):
        x, = ctx.saved_tensors
        alpha = ctx.alpha
        # ATan surrogate derivative: alpha / (2 * (1 + (pi/2 * alpha * x)^2))
        grad = alpha / (2.0 * (1.0 + (3.141592653589793 / 2.0 * alpha * x) ** 2))
        return grad_output * grad, None


def heaviside_atan(x, alpha=2.0):
    return SurrogateHeaviside.apply(x, alpha)


class NativeLIFNode(nn.Module):
    """Native PyTorch Leaky Integrate-and-Fire node supporting Apple Silicon MPS & CUDA."""

    def __init__(self, tau: float = 2.0, v_threshold: float = 1.0, v_reset: float = 0.0):
        super().__init__()
        self.tau = tau
        self.decay = 1.0 - (1.0 / tau)
        self.v_threshold = v_threshold
        self.v_reset = v_reset

    def forward(self, x_seq: torch.Tensor) -> torch.Tensor:
        """x_seq: (T, Batch, Features) -> spikes: (T, Batch, Features)"""
        T, B, F = x_seq.shape
        spikes = []
        v = torch.zeros(B, F, device=x_seq.device, dtype=x_seq.dtype)

        for t in range(T):
            v = self.decay * v + x_seq[t]
            spike = heaviside_atan(v - self.v_threshold)
            v = v * (1.0 - spike) + self.v_reset * spike
            spikes.append(spike)

        return torch.stack(spikes, dim=0)


class SpikingPhysiologyNet(nn.Module):
    """Deep Spiking Neural Network for spatiotemporal vital signs prediction."""

    def __init__(self, in_channels: int = 8, hidden_dim: int = 64, tau: float = 2.0):
        super().__init__()
        self.fc1 = nn.Linear(in_channels, hidden_dim)
        self.lif1 = NativeLIFNode(tau=tau)
        self.fc2 = nn.Linear(hidden_dim, hidden_dim // 2)
        self.lif2 = NativeLIFNode(tau=tau)
        self.fc_out = nn.Linear(hidden_dim // 2, 1)

    def forward(self, x_seq: torch.Tensor) -> torch.Tensor:
        """
        x_seq shape: (T, Batch, N_CHANNELS)
        Returns: (Batch, 1) predicted recovery score
        """
        T, B, _ = x_seq.shape
        h1 = self.fc1(x_seq.reshape(T * B, -1)).reshape(T, B, -1)
        s1 = self.lif1(h1)
        h2 = self.fc2(s1.reshape(T * B, -1)).reshape(T, B, -1)
        s2 = self.lif2(h2)
        out = self.fc_out(s2.reshape(T * B, -1)).reshape(T, B, -1)

        # Temporal integration: mean across time steps
        return out.mean(dim=0)


def train_snn(args):
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    console.print(Panel(
        f"[bold cyan]Local Spiking Neural Network (SNN) Training Pipeline[/bold cyan]\n"
        f"Epochs: {args.epochs} | Batch size: {args.batch_size} | LR: {args.lr}\n"
        f"Sequence Length: {args.seq_len} steps | Channels: {N_CHANNELS}",
        title="🧠 NeuroVerse AI — Intraoperative Spiking Physiology Layer",
    ))

    # Detect device
    if torch.cuda.is_available() and not args.cpu:
        device = torch.device("cuda")
    elif torch.backends.mps.is_available() and not args.cpu:
        device = torch.device("mps")
    else:
        device = torch.device("cpu")

    console.print(f"[bold green]✔ Training on Device: {device}[/bold green]")

    # Dataset & Loader
    dataset = SyntheticPhysiologyDataset(n_sequences=args.n_samples, seq_len=args.seq_len)
    n_val = max(1, int(len(dataset) * 0.2))
    train_ds, val_ds = torch.utils.data.random_split(dataset, [len(dataset) - n_val, n_val])

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False)

    console.print(f"Dataset: [green]{len(train_ds)} train[/green], [cyan]{len(val_ds)} val[/cyan]")

    # Model
    model = SpikingPhysiologyNet(in_channels=N_CHANNELS, hidden_dim=args.hidden_dim).to(device)
    total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    console.print(f"Spiking Model: [bold]LIF Architecture[/bold] (Parameters: [cyan]{total_params:,}[/cyan])")

    criterion = nn.MSELoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)

    best_val_loss = float("inf")

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        model.train()
        train_loss = 0.0

        for seqs, targets in train_loader:
            # Reshape for SpikingJelly step_mode="m": (T, Batch, N_CHANNELS)
            seqs = seqs.permute(1, 0, 2).to(device)
            targets = targets.to(device)

            optimizer.zero_grad()
            preds = model(seqs)
            loss = criterion(preds, targets)
            loss.backward()

            optimizer.step()
            train_loss += loss.item()

        train_loss /= len(train_loader)

        # Validation
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for seqs, targets in val_loader:
                seqs = seqs.permute(1, 0, 2).to(device)
                targets = targets.to(device)

                preds = model(seqs)
                val_loss += criterion(preds, targets).item()

        val_loss /= len(val_loader)
        dt = time.time() - t0

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "val_loss": val_loss,
                "hidden_dim": args.hidden_dim,
                "in_channels": N_CHANNELS,
            }, output_path)
            saved_marker = "[green]★ saved[/green]"
        else:
            saved_marker = ""

        console.print(
            f"Epoch [{epoch:02d}/{args.epochs:02d}] "
            f"Train MSE: [red]{train_loss:.5f}[/red] | "
            f"Val MSE: [yellow]{val_loss:.5f}[/yellow] | "
            f"Time: {dt:.2f}s {saved_marker}"
        )

    console.print(Panel(
        f"[bold green]SNN Physiology Model Trained Successfully![/bold green]\n"
        f"Best Val MSE: [bold cyan]{best_val_loss:.5f}[/bold cyan]\n"
        f"Checkpoint Saved: [yellow]{output_path}[/yellow]",
        title="SNN Training Summary",
    ))


def main():
    parser = argparse.ArgumentParser(description="Train SNN Physiology Model on Apple Silicon")
    parser.add_argument("--epochs", type=int, default=10, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=8, help="Batch size")
    parser.add_argument("--lr", type=float, default=2e-3, help="Learning rate")
    parser.add_argument("--hidden-dim", type=int, default=64, help="Hidden neuron dimension")
    parser.add_argument("--seq-len", type=int, default=32, help="Sequence length (timesteps)")
    parser.add_argument("--n-samples", type=int, default=150, help="Number of synthetic time-series")
    parser.add_argument("--output", type=str, default="models/snn_physiology_best.pt", help="Checkpoint output path")
    parser.add_argument("--cpu", action="store_true", help="Force CPU")

    args = parser.parse_args()
    train_snn(args)


if __name__ == "__main__":
    main()
