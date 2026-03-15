# Manual Installations (Kubernetes v1.30 auf Ubuntu 22.04)

### 1. System vorbereiten (Swap & Kernel-Module)

sudo swapoff -a
sudo sed -i '/ swap / s/^\(.\*\)$/#\1/g' /etc/fstab

cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward = 1
EOF

sudo sysctl --system

# Hostname setzen und in /etc/hosts eintragen

sudo hostnamectl set-hostname master-node
IP_ADDRESS=$(hostname -I | awk '{print $1}')
echo "$IP_ADDRESS master-node" | sudo tee -a /etc/hosts

### 2. Container Runtime (Containerd) installieren

sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl containerd

# Containerd Standard-Konfiguration erstellen und Systemd Cgroup-Treiber aktivieren

sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml > /dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

sudo systemctl restart containerd
sudo systemctl enable containerd

### 3. Kubernetes Tools installieren (v1.30)

curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.30/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.30/deb/ /' | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl

### 4. Cluster initialisieren (Nur auf dem Master Node)

# Wir fügen --pod-network-cidr hinzu, da Calico (unser Netzwerk-Plugin) dieses Subnetz standardmäßig nutzt.

# HINWEIS: Wenn deine VM weniger als 2 CPUs oder 2GB RAM hat, wird der folgende Befehl fehlschlagen.

# Für reine Testzwecke kannst du die Prüfung mit --ignore-preflight-errors=... umgehen.

# Für eine stabile Umgebung solltest du aber eine größere VM verwenden (z.B. Hetzner cx22 oder 2 CPUs/4GB RAM lokal).

sudo kubeadm init --control-plane-endpoint=master-node --pod-network-cidr=192.168.0.0/16 --upload-certs --ignore-preflight-errors=NumCPU,Mem

# Kubeconfig für den aktuellen Benutzer einrichten

mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

### 5. CNI Network Plugin installieren (Calico)

# Ohne CNI bleiben die Nodes auf Status "NotReady" und Pods "Pending".

kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.28.0/manifests/tigera-operator.yaml
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.28.0/manifests/custom-resources.yaml

# Prüfen ob alles läuft (kann ein paar Minuten dauern):

# kubectl get pods -n calico-system

# kubectl get nodes
