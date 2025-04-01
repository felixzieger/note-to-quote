set dotenv-load
set dotenv-required

# Run the bot locally
run_bot:
    cd bot && uv run --env-file=.env src/note_to_quote_bot/main.py

# Run the web application locally
run_web:
    cd web && npm run dev

# Increment minor version, create and push git tag
bump_version:
    #!/usr/bin/env sh
    # Check for uncommitted changes in Nix repo
    if [ -n "$(cd "${NIXCONFIG_REPO_PATH}" && git status --porcelain)" ]; then
        echo "Error: There are uncommitted changes in the Nix config repo"
        exit 1
    fi

    echo "Bumping version in note-to-quote repo"
    CURRENT_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0")
    MAJOR=$(echo $CURRENT_TAG | cut -d. -f1)
    MINOR=$(echo $CURRENT_TAG | cut -d. -f2)
    NEW_MINOR=$((MINOR + 1))
    NEW_TAG="${MAJOR}.${NEW_MINOR}"
    git push --quiet
    git tag $NEW_TAG
    git push origin $NEW_TAG --quiet
    echo "Bumped version in Docsy repo from $CURRENT_TAG to $NEW_TAG"

    # Update the version in the Nix file
    echo "Bumping version in Nix file"
    sed -i "" "s/noteToQuoteVersion = \".*\"/noteToQuoteVersion = \"${NEW_TAG}\"/" "${NIXCONFIG_REPO_PATH}/services/note-to-quote.nix"
    (cd "${NIXCONFIG_REPO_PATH}" && \
        git add services/note-to-quote.nix && \
        git commit -m "bump docsy version" --quiet && \
        git push --quiet)
    echo "Bumped version in Nix config repo to $NEW_TAG"

# Wait for image to be build on github and deploy on nixos host
deploy_on_schwalbe:
    #!/usr/bin/env sh

    # Wait until the docker image is built
    RUN_ID=$(gh run list --commit $(git rev-parse HEAD) --json databaseId | jq -r '.[0].databaseId')
    gh run watch $RUN_ID --exit-status

    # Then deploy
    ssh schwalbe "cd /etc/nixos && sudo -E git pull --quiet && just switch"
