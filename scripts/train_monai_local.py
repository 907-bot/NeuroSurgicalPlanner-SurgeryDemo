#!/usr/bin/env python3
"""
scripts/train_monai_local.py
Locally optimized MONAI training pipeline for Brain Tumor Segmentation (BraTS).

Tailored for Apple Silicon (M-series / MPS) and 16 GB Unified Memory:
- Mixed precision support (torch.autocast on MPS / CPU)
- Patch-based spatial sampling (RandCropByPosNegLabeld) to minimize VRAM
- SegResNet (low parameter count, high efficiency)
- Gradient accumulation (effective batch size scaling without memory penalty)
- PersistentDataset with disk caching to avoid exhausting system RAM
- Periodic memory flushing (gc.collect and torch.mps.empty_cache)
"""

from __future__ import annotations

import argparse
import gc
import json
import os
import sys

os.environ["MPLCONFIGDIR"] = "/tmp/matplotlib_cache"
import time
from pathlib import Path
from typing import Dict, List, Tuple

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from loguru import logger
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn

console = Console()

import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

import monai
from monai.data import DataLoader, Dataset, PersistentDataset
from monai.inferers import sliding_window_inference
from monai.losses import DiceCELoss
from monai.metrics import DiceMetric
from monai.networks.nets import SegResNet, UNet
from monai.transforms import (
    Activations,
    AsDiscrete,
    Compose,
    EnsureChannelFirstd,
    EnsureTyped,
    LoadImaged,
    NormalizeIntensityd,
    Orientationd,
    RandCropByPosNegLabeld,
    RandFlipd,
    RandRotate90d,
    Spacingd,
)


def discover_brats_cases(data_dir: Path) -> List[Dict[str, any]]:
    """
    Scans data_dir for BraTS patient subdirectories containing:
    *_t1.nii.gz, *_t1ce.nii.gz, *_t2.nii.gz, *_flair.nii.gz, *_seg.nii.gz
    """
    cases = []
    patient_dirs = sorted([d for d in data_dir.iterdir() if d.is_dir()])
    
    for pdir in patient_dirs:
        pid = pdir.name
        t1 = list(pdir.glob("*_t1.nii.gz"))
        t1ce = list(pdir.glob("*_t1ce.nii.gz"))
        t2 = list(pdir.glob("*_t2.nii.gz"))
        flair = list(pdir.glob("*_flair.nii.gz"))
        seg = list(pdir.glob("*_seg.nii.gz"))

        if t1 and t1ce and t2 and flair and seg:
            cases.append({
                "patient_id": pid,
                # Stacking 4 modalities into a single 4-channel image
                "image": [str(t1[0]), str(t1ce[0]), str(t2[0]), str(flair[0])],
                "label": str(seg[0]),
            })

    return cases


def build_transforms(patch_size: int = 96):
    """Build train and validation MONAI transform pipelines."""
    train_transforms = Compose([
        LoadImaged(keys=["image", "label"], image_only=False),
        EnsureChannelFirstd(keys=["image", "label"]),
        Orientationd(keys=["image", "label"], axcodes="RAS"),
        Spacingd(
            keys=["image", "label"],
            pixdim=(1.0, 1.0, 1.0),
            mode=("bilinear", "nearest"),
        ),
        NormalizeIntensityd(keys=["image"], nonzero=True, channel_wise=True),
        RandCropByPosNegLabeld(
            keys=["image", "label"],
            label_key="label",
            spatial_size=(patch_size, patch_size, patch_size),
            pos=2,
            neg=1,
            num_samples=2,
            image_key="image",
            image_threshold=0,
        ),
        RandFlipd(keys=["image", "label"], spatial_axis=[0, 1, 2], prob=0.5),
        RandRotate90d(keys=["image", "label"], max_k=3, prob=0.5),
        EnsureTyped(keys=["image", "label"]),
    ])

    val_transforms = Compose([
        LoadImaged(keys=["image", "label"], image_only=False),
        EnsureChannelFirstd(keys=["image", "label"]),
        Orientationd(keys=["image", "label"], axcodes="RAS"),
        Spacingd(
            keys=["image", "label"],
            pixdim=(1.0, 1.0, 1.0),
            mode=("bilinear", "nearest"),
        ),
        NormalizeIntensityd(keys=["image"], nonzero=True, channel_wise=True),
        EnsureTyped(keys=["image", "label"]),
    ])

    return train_transforms, val_transforms


def flush_local_memory():
    """Aggressively release unused memory back to the macOS unified pool."""
    gc.collect()
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()


def train(args):
    data_dir = Path(args.data_dir)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cache_dir = Path(args.cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)

    console.print(Panel(
        f"[bold cyan]Local MONAI BraTS Training Pipeline (Apple Silicon M5)[/bold cyan]\n"
        f"Data dir: [green]{data_dir}[/green] | Output: [yellow]{output_path}[/yellow]\n"
        f"Patch size: {args.patch_size}³ | Epochs: {args.epochs} | Accum steps: {args.accum_steps}",
        title="🧠 NeuroVerse AI — Local Medical Imaging Engine",
    ))

    # Detect device
    if torch.backends.mps.is_available() and not args.cpu:
        device = torch.device("mps")
        console.print("[bold green]✔ Hardware Acceleration: Apple Metal Performance Shaders (MPS)[/bold green]")
    else:
        device = torch.device("cpu")
        console.print("[yellow]⚠ Using CPU execution[/yellow]")

    # Discover cases
    cases = discover_brats_cases(data_dir)
    if not cases:
        console.print(f"[bold red]No valid BraTS cases found in {data_dir}[/bold red]")
        sys.exit(1)

    console.print(f"Found [bold cyan]{len(cases)}[/bold cyan] BraTS cases: {[c['patient_id'] for c in cases]}")

    # Train / Val split (leave 1 case for validation if small, or 25%)
    n_val = max(1, int(len(cases) * 0.25))
    val_files = cases[:n_val]
    train_files = cases[n_val:] if len(cases) > 1 else cases

    console.print(f"Dataset split: [green]{len(train_files)} train[/green], [cyan]{len(val_files)} val[/cyan]")

    # Build transforms
    train_transforms, val_transforms = build_transforms(patch_size=args.patch_size)

    # Use PersistentDataset to prevent memory blow-up on 16GB RAM
    train_ds = PersistentDataset(data=train_files, transform=train_transforms, cache_dir=str(cache_dir / "train"))
    val_ds = PersistentDataset(data=val_files, transform=val_transforms, cache_dir=str(cache_dir / "val"))

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,  # 0 workers avoids multiprocessing memory duplication on macOS
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=1,
        shuffle=False,
        num_workers=0,
    )

    # Model: SegResNet (4 channels input -> 4 output classes)
    model = SegResNet(
        spatial_dims=3,
        in_channels=4,
        out_channels=4,
        init_filters=16,
        blocks_down=[1, 2, 2, 4],
        blocks_up=[1, 1, 1],
        dropout_prob=0.2,
    ).to(device)

    total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    console.print(f"Model: [bold]SegResNet[/bold] (Trainable parameters: [cyan]{total_params:,}[/cyan])")

    loss_fn = DiceCELoss(to_onehot_y=True, softmax=True)
    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=1e-5)
    scheduler = CosineAnnealingLR(optimizer, T_max=args.epochs, eta_min=1e-6)

    dice_metric = DiceMetric(include_background=False, reduction="mean")
    post_trans = Compose([
        Activations(softmax=True),
        AsDiscrete(argmax=True, to_onehot=4),
    ])

    best_val_dice = -1.0
    history = {"train_loss": [], "val_dice": [], "epoch_times": []}

    # Training loop
    console.print("\n[bold]Starting Local Training Loop...[/bold]")

    for epoch in range(1, args.epochs + 1):
        epoch_start = time.time()
        model.train()
        train_loss = 0.0
        step = 0
        optimizer.zero_grad()

        for batch_data in train_loader:
            step += 1
            inputs, labels = batch_data["image"].to(device), batch_data["label"].to(device)

            # Mixed precision context if on MPS or CPU
            with torch.amp.autocast(device_type=device.type, dtype=torch.float16 if device.type == "mps" else torch.bfloat16):
                outputs = model(inputs)
                loss = loss_fn(outputs, labels)
                # Scale loss for gradient accumulation
                loss = loss / args.accum_steps

            loss.backward()

            if step % args.accum_steps == 0 or step == len(train_loader):
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                optimizer.zero_grad()

            train_loss += loss.item() * args.accum_steps

        scheduler.step()
        train_loss /= max(1, step)
        flush_local_memory()

        # Validation
        val_dice = 0.0
        if epoch % args.val_interval == 0 or epoch == args.epochs:
            model.eval()
            with torch.no_grad():
                for val_data in val_loader:
                    val_inputs, val_labels = val_data["image"].to(device), val_data["label"].to(device)
                    # Sliding window inference for full volume
                    val_outputs = sliding_window_inference(
                        inputs=val_inputs,
                        roi_size=(args.patch_size, args.patch_size, args.patch_size),
                        sw_batch_size=1,
                        predictor=model,
                        overlap=0.25,
                    )
                    val_outputs = [post_trans(i) for i in monai.data.decollate_batch(val_outputs)]
                    val_labels_onehot = [AsDiscrete(to_onehot=4)(i) for i in monai.data.decollate_batch(val_labels)]
                    dice_metric(y_pred=val_outputs, y=val_labels_onehot)

                val_dice = dice_metric.aggregate().item()
                dice_metric.reset()

            flush_local_memory()

            if val_dice > best_val_dice:
                best_val_dice = val_dice
                torch.save({
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "val_dice": val_dice,
                    "model_type": "segresnet",
                    "in_channels": 4,
                    "out_channels": 4,
                }, output_path)

        epoch_time = time.time() - epoch_start
        history["train_loss"].append(train_loss)
        history["val_dice"].append(val_dice)
        history["epoch_times"].append(epoch_time)

        dice_display = f"{val_dice:.4f}" if val_dice > 0 else "---"
        console.print(
            f"Epoch [{epoch:02d}/{args.epochs:02d}] "
            f"Train Loss: [red]{train_loss:.4f}[/red] | "
            f"Val Dice: [green]{dice_display}[/green] | "
            f"Time: {epoch_time:.1f}s"
        )

    # Save training history
    history_path = output_path.parent / "monai_training_history.json"
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)

    console.print(Panel(
        f"[bold green]Training Completed Successfully![/bold green]\n"
        f"Best Val Dice: [bold cyan]{best_val_dice:.4f}[/bold cyan]\n"
        f"Checkpoint: [yellow]{output_path}[/yellow]\n"
        f"History: [yellow]{history_path}[/yellow]",
        title="Training Summary",
    ))


def main():
    parser = argparse.ArgumentParser(description="Local MONAI BraTS Training on Apple Silicon M-Series")
    parser.add_argument("--data-dir", type=str, default="data/adapted", help="Path to BraTS adapted data")
    parser.add_argument("--epochs", type=int, default=10, help="Number of epochs")
    parser.add_argument("--batch-size", type=int, default=1, help="Batch size per step")
    parser.add_argument("--accum-steps", type=int, default=4, help="Gradient accumulation steps")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--patch-size", type=int, default=96, help="3D patch ROI dimension")
    parser.add_argument("--val-interval", type=int, default=2, help="Validation frequency (epochs)")
    parser.add_argument("--output", type=str, default="models/monai_brats_best.pt", help="Checkpoint save path")
    parser.add_argument("--cache-dir", type=str, default=".cache/monai", help="Persistent cache directory")
    parser.add_argument("--cpu", action="store_true", help="Force CPU mode")

    args = parser.parse_args()
    train(args)


if __name__ == "__main__":
    main()
