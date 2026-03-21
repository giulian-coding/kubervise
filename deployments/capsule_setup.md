kubeadm setup

install helm kubectl
helm repo add projectcapsule https://projectcapsule.github.io/charts
helm repo update
helm install capsule projectcapsule/capsule --namespace capsule-system --create-namespace

NAME: capsule
LAST DEPLOYED: Fri Mar 20 19:19:52 2026
NAMESPACE: capsule-system
STATUS: deployed
REVISION: 1
DESCRIPTION: Install complete
TEST SUITE: None
NOTES:

- Capsule Operator Helm Chart deployed:

  # Check the capsule logs

  $ kubectl logs -f deployment/capsule-controller-manager -c manager -n capsule-system

  # Check the capsule logs

  $ kubectl logs -f deployment/capsule-controller-manager -c manager -n capsule-system

- Manage this chart:

  # Upgrade Capsule

  $ helm upgrade capsule -f <values.yaml> capsule -n capsule-system

  # Show this status again

  $ helm status capsule -n capsule-system

  # Uninstall Capsule

  $ helm uninstall capsule -n capsule-system
