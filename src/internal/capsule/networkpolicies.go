package capsule

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var networkPolicyGVR = schema.GroupVersionResource{
	Group:    "networking.k8s.io",
	Version:  "v1",
	Resource: "networkpolicies",
}

// CreateNetworkPolicy erlaubt Traffic von einem Quell-Namespace in den Ziel-Namespace
func (m *Manager) CreateNetworkPolicy(ctx context.Context, targetNamespace, name, sourceNamespace string) error {
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "networking.k8s.io/v1",
			"kind":       "NetworkPolicy",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": targetNamespace, // Die Policy MUSS im Ziel-Namespace liegen
			},
			"spec": map[string]interface{}{
				"podSelector": map[string]interface{}{}, // Ein leerer Selector wählt ALLE Pods im Ziel-Namespace aus
				"policyTypes": []interface{}{
					"Ingress",
				},
				"ingress": []interface{}{
					map[string]interface{}{
						"from": []interface{}{
							map[string]interface{}{
								"namespaceSelector": map[string]interface{}{
									"matchLabels": map[string]interface{}{
										"kubernetes.io/metadata.name": sourceNamespace, // Erlaubt Traffic vom Quell-Namespace
									},
								},
							},
						},
					},
				},
			},
		},
	}

	_, err := m.client.Resource(networkPolicyGVR).Namespace(targetNamespace).Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("fehler beim Erstellen der NetworkPolicy %s: %w", name, err)
	}
	return nil
}

func (m *Manager) ListNetworkPolicies(ctx context.Context, namespace string) ([]map[string]interface{}, error) {
	list, err := m.client.Resource(networkPolicyGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var formattedPolicies []map[string]interface{}
	for _, item := range list.Items {
		// Fürs Frontend reicht meist der Name und die ID, um die "Verbindungen" anzuzeigen
		formattedPolicies = append(formattedPolicies, map[string]interface{}{
			"id":   item.GetName(),
			"name": item.GetName(),
		})
	}
	return formattedPolicies, nil
}

func (m *Manager) DeleteNetworkPolicy(ctx context.Context, namespace, name string) error {
	err := m.client.Resource(networkPolicyGVR).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("fehler beim Löschen der NetworkPolicy %s: %w", name, err)
	}
	return nil
}
