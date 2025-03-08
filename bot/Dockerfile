FROM python:3.12-slim

# Install system dependencies required for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y \
    google-chrome-stable \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

COPY . .

# Install Python dependencies
RUN pip install -e .

# Install Playwright browsers
# Note: Chrome isn't available for ARM on ubuntu/debian.
RUN python -m playwright install chromium

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run the bot
CMD ["note-to-quote-bot"] 