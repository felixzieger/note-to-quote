#!/bin/bash

# Install Python dependencies using uv
uv pip install -e .

# Install Playwright browsers
python -m playwright install chromium 