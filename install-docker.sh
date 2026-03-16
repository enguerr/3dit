#!/bin/bash

# Script d'installation de Docker et Docker Compose
# À exécuter avec: sudo bash install-docker.sh

set -e

echo "=== Installation de Docker ==="

# Mise à jour des paquets
apt-get update

# Installation des dépendances
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Ajout de la clé GPG officielle de Docker
mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Configuration du dépôt Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installation de Docker Engine, CLI et Containerd
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Démarrage et activation de Docker au démarrage
systemctl start docker
systemctl enable docker

# Ajout de l'utilisateur actuel au groupe docker (pour éviter d'utiliser sudo)
usermod -aG docker $SUDO_USER

echo ""
echo "=== Installation terminée ==="
echo "Docker version:"
docker --version
echo ""
echo "Docker Compose version:"
docker compose version
echo ""
echo "⚠️  IMPORTANT: Vous devez vous déconnecter et vous reconnecter (ou exécuter 'newgrp docker')"
echo "   pour que les changements de groupe prennent effet."
echo ""
echo "Vous pouvez maintenant démarrer le projet avec: docker compose up -d"
