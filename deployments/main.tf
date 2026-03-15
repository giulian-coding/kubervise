terraform {
  required_version = ">= 1.5"

  required_providers {
    hcloud = {
      source = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

############################
# NETWORK
############################

resource "hcloud_network" "k8s" {
  name     = "k8s-network"
  ip_range = "10.0.0.0/16"
}

resource "hcloud_network_subnet" "k8s" {
  network_id   = hcloud_network.k8s.id
  type         = "cloud"
  network_zone = "eu-central"
  ip_range     = "10.0.1.0/24"
}

############################
# SERVER
############################

resource "hcloud_server" "master" {
  name        = "k8s-master"
  image       = "ubuntu-22.04"
  server_type = "cx22"
  location    = "fsn1"

  network {
    network_id = hcloud_network.k8s.id
    ip         = "10.0.1.2"
  }

  user_data = file("cloud-init.yaml")
}

############################
# FIREWALL
############################

resource "hcloud_firewall" "k8s" {
  name = "k8s-fw"

  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "22"
    source_ips = ["0.0.0.0/0"]
  }

  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "6443"
    source_ips = ["0.0.0.0/0"]
  }

  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "80-443"
    source_ips = ["0.0.0.0/0"]
  }
}

resource "hcloud_firewall_attachment" "fw_attach" {
  firewall_id = hcloud_firewall.k8s.id
  server_ids  = [hcloud_server.master.id]
}