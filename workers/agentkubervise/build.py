#!/usr/bin/env python3
"""
Build script for creating standalone Kubervise Agent binaries.

Requirements:
    pip install pyinstaller

Usage:
    python build.py           # Build for current platform
    python build.py --all     # Build for all platforms (requires cross-compilation tools)
"""
import os
import subprocess
import sys
import platform
import shutil
from pathlib import Path


def get_platform_suffix():
    """Get the platform suffix for the binary name"""
    system = platform.system().lower()
    machine = platform.machine().lower()

    # Normalize architecture names
    if machine in ('x86_64', 'amd64'):
        arch = 'amd64'
    elif machine in ('arm64', 'aarch64'):
        arch = 'arm64'
    elif machine in ('i386', 'i686', 'x86'):
        arch = '386'
    else:
        arch = machine

    return f"{system}-{arch}"


def build_binary(output_name: str = None):
    """Build the binary for the current platform"""
    suffix = get_platform_suffix()
    if output_name is None:
        output_name = f"agentkubervise-{suffix}"

    # Add .exe extension on Windows
    if platform.system().lower() == 'windows':
        output_name += '.exe'

    print(f"Building {output_name}...")

    # PyInstaller command
    cmd = [
        sys.executable, '-m', 'PyInstaller',
        '--onefile',
        '--name', output_name,
        '--clean',
        '--noconfirm',
        # Hidden imports for kubernetes client
        '--hidden-import', 'kubernetes',
        '--hidden-import', 'kubernetes.client',
        '--hidden-import', 'kubernetes.config',
        '--hidden-import', 'httpx',
        '--hidden-import', 'click',
        '--hidden-import', 'certifi',
        '--hidden-import', 'urllib3',
        # Entry point
        'cli.py',
    ]

    result = subprocess.run(cmd, cwd=Path(__file__).parent)

    if result.returncode == 0:
        # Move to dist folder with proper name
        dist_path = Path(__file__).parent / 'dist' / output_name
        if dist_path.exists():
            print(f"Successfully built: {dist_path}")
            return dist_path
    else:
        print(f"Build failed with return code {result.returncode}")
        return None


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Build Kubervise Agent binary')
    parser.add_argument('--all', action='store_true', help='Build for all platforms (not yet supported)')
    parser.add_argument('--output', '-o', help='Output binary name')
    args = parser.parse_args()

    if args.all:
        print("Cross-platform building not yet supported.")
        print("Please build on each target platform separately.")
        print("\nFor cross-compilation, consider using Docker:")
        print("  docker run -v $(pwd):/src -w /src python:3.11 python build.py")
        sys.exit(1)

    # Ensure we're in the right directory
    os.chdir(Path(__file__).parent)

    # Check for PyInstaller
    try:
        import PyInstaller
    except ImportError:
        print("PyInstaller not found. Installing...")
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'pyinstaller'])

    # Build
    binary_path = build_binary(args.output)

    if binary_path:
        print(f"\nBuild complete!")
        print(f"Binary location: {binary_path}")
        print(f"\nTo test the binary:")
        print(f"  {binary_path} --help")


if __name__ == '__main__':
    main()
