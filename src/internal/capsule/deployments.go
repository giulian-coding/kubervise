package capsule

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var deploymentGVR = schema.GroupVersionResource{
	Group:    "apps",
	Version:  "v1",
	Resource: "deployments",
}

var podGVR = schema.GroupVersionResource{
	Group:    "", // Pods gehören zur Core-API (keine Gruppe)
	Version:  "v1",
	Resource: "pods",
}

// CreateDeployment erstellt ein einfaches Deployment mit einem Container
func (m *Manager) CreateDeployment(ctx context.Context, namespace, name, image string) error {
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "apps/v1",
			"kind":       "Deployment",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": namespace,
			},
			"spec": map[string]interface{}{
				"replicas": int64(1), // Wir starten standardmäßig mit 1 Replika
				"selector": map[string]interface{}{
					"matchLabels": map[string]interface{}{
						"app": name,
					},
				},
				"template": map[string]interface{}{
					"metadata": map[string]interface{}{
						"labels": map[string]interface{}{
							"app": name,
						},
					},
					"spec": map[string]interface{}{
						"containers": []interface{}{
							map[string]interface{}{
								"name":  name,
								"image": image, // Das Image (z.B. nginx, mongo)
							},
						},
					},
				},
			},
		},
	}

	// WICHTIG: Hier fügen wir .Namespace(namespace) hinzu!
	_, err := m.client.Resource(deploymentGVR).Namespace(namespace).Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("fehler beim Erstellen des Deployments %s: %w", name, err)
	}
	return nil
}

func (m *Manager) ListDeployments(ctx context.Context, namespace string) ([]map[string]interface{}, error) {
	list, err := m.client.Resource(deploymentGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var formattedDeployments []map[string]interface{}
	for _, item := range list.Items {
		readyReplicas, _, _ := unstructured.NestedInt64(item.Object, "status", "readyReplicas")
		replicas, _, _ := unstructured.NestedInt64(item.Object, "spec", "replicas")

		containers, _, _ := unstructured.NestedSlice(item.Object, "spec", "template", "spec", "containers")
		var image string
		if len(containers) > 0 {
			if containerMap, ok := containers[0].(map[string]interface{}); ok {
				image, _ = containerMap["image"].(string)
			}
		}

		formattedDeployments = append(formattedDeployments, map[string]interface{}{
			"id":            item.GetName(),
			"name":          item.GetName(),
			"image":         image,
			"replicas":      replicas,
			"readyReplicas": readyReplicas,
		})
	}
	return formattedDeployments, nil
}

func (m *Manager) DeleteDeployment(ctx context.Context, namespace, name string) error {
	err := m.client.Resource(deploymentGVR).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("fehler beim Löschen des Deployments %s: %w", name, err)
	}
	return nil
}

func (m *Manager) ListPods(ctx context.Context, namespace string) ([]map[string]interface{}, error) {
	list, err := m.client.Resource(podGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var formattedPods []map[string]interface{}
	for _, item := range list.Items {
		phase, _, _ := unstructured.NestedString(item.Object, "status", "phase")

		formattedPods = append(formattedPods, map[string]interface{}{
			"id":    item.GetName(),
			"name":  item.GetName(),
			"phase": phase, // z.B. Running, Pending, Failed
		})
	}
	return formattedPods, nil
}
