kubeadm setup

install helm kubectl
helm repo add projectcapsule https://projectcapsule.github.io/charts
helm repo update
helm install capsule projectcapsule/capsule --namespace capsule-system --create-namespace
