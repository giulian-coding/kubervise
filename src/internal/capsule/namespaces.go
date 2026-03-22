package capsule

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// namespaceGVR definiert, wo Namespaces in der K8s API liegen
var namespaceGVR = schema.GroupVersionResource{
	Group:    "", // Core API hat keine benannte Gruppe
	Version:  "v1",
	Resource: "namespaces",
}

// ListNamespaces sucht alle Namespaces, die zu einem bestimmten Tenant gehören
func (m *Manager) ListNamespaces(ctx context.Context, tenantName string) ([]map[string]interface{}, error) {
	// Capsule markiert Namespaces mit Labels. Wir filtern direkt danach!
	labelSelector := fmt.Sprintf("capsule.clastix.io/tenant=%s", tenantName)

	list, err := m.client.Resource(namespaceGVR).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return nil, err
	}

	var formattedNamespaces []map[string]interface{}
	for _, item := range list.Items {
		// Schneidet den Präfix für die Frontend-Anzeige ab (z.B. "kunde-a-development" -> "development")
		cleanName := strings.TrimPrefix(item.GetName(), tenantName+"-")
		formattedNamespaces = append(formattedNamespaces, map[string]interface{}{
			"id":   item.GetName(), // Die ID MUSS der echte K8s Name bleiben für Folge-Requests
			"name": cleanName,      // Der Anzeigename im Frontend (ohne Präfix)
		})
	}

	return formattedNamespaces, nil
}

// CreateNamespace erstellt einen Namespace und weist ihn dem Tenant zu
func (m *Manager) CreateNamespace(ctx context.Context, name string, tenantName string) error {
	// Um Namenskonflikte zu vermeiden, präfixen wir den Namespace mit dem Tenant-Namen
	prefixedName := fmt.Sprintf("%s-%s", tenantName, name)

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "v1",
			"kind":       "Namespace",
			"metadata": map[string]interface{}{
				"name": prefixedName,
				"labels": map[string]interface{}{
					"capsule.clastix.io/tenant": tenantName, // Ordnet den Namespace dem Tenant zu
				},
			},
		},
	}

	_, err := m.client.Resource(namespaceGVR).Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("fehler beim Erstellen des Namespaces %s: %w", prefixedName, err)
	}
	return nil
}

// DeleteNamespace löscht einen Namespace komplett aus dem Cluster
func (m *Manager) DeleteNamespace(ctx context.Context, name string) error {
	err := m.client.Resource(namespaceGVR).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			// Wir geben ein spezielles Präfix zurück, das der Handler erkennen kann
			return fmt.Errorf("not_found: Namespace '%s' existiert nicht (hast du die echte K8s-ID verwendet?)", name)
		}
		return fmt.Errorf("fehler beim Löschen des Namespaces %s: %w", name, err)
	}
	return nil
}
