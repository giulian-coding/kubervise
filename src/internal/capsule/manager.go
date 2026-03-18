package capsule

import (
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"
)

// GVR zentral definieren, damit wir uns nicht verschreiben
var tenantGVR = schema.GroupVersionResource{
	Group:    "capsule.clastix.io",
	Version:  "v1beta2",
	Resource: "tenants",
}

// Manager hält die Verbindung zum Cluster
type Manager struct {
	client dynamic.Interface
}

// NewManager ist der "Konstruktor" für unseren Capsule-Dienst
func NewManager(client dynamic.Interface) *Manager {
	return &Manager{
		client: client,
	}
}

// CreateTenant führt die eigentliche Erstellung aus
func (m *Manager) CreateTenant(ctx context.Context, name string, owner string) error {
	// 1. Wir nutzen unseren Builder, um das Objekt zu holen
	obj := CreateTenantObject(name, owner)

	// 2. Wir senden es an den Cluster
	_, err := m.client.Resource(tenantGVR).Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("fehler beim Erstellen des Tenants %s: %w", name, err)
	}
	fmt.Printf("Tenant %s erfolgreich erstellt.\n", name)
	return nil
}

// GetTenant versucht einen spezifischen Tenant anhand des Namens zu finden
func (m *Manager) GetTenant(ctx context.Context, name string) (*unstructured.Unstructured, error) {
	// Wir nutzen den client.Resource().Get() Aufruf
	// Da Tenants Cluster-Scoped sind, bleibt der .Namespace("") Teil weg
	obj, err := m.client.Resource(tenantGVR).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return obj, nil
}

func (m *Manager) DeleteTenant(ctx context.Context, name string) error {
	err := m.client.Resource(tenantGVR).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		// Wir prüfen, ob der Fehler besagt, dass der Tenant gar nicht da war
		if errors.IsNotFound(err) {
			fmt.Printf("ℹ️ Tenant %s wurde nicht gefunden, nichts zu löschen.\n", name)
			return nil
		}
		return fmt.Errorf("konnte Tenant %s nicht löschen: %w", name, err)
	}
	fmt.Printf("🗑️ Tenant %s erfolgreich gelöscht.\n", name)
	return nil

}

func (m *Manager) UpdateTenantQuota(ctx context.Context, name string, newQuota int64) error {
	// 1. Wir erstellen ein Patch-Objekt (JSON-Struktur)
	// Hier sagen wir: "Gehe zu spec.namespaceOptions.quota und setze den neuen Wert"
	patchData := map[string]interface{}{
		"spec": map[string]interface{}{
			"namespaceOptions": map[string]interface{}{
				"quota": newQuota,
			},
		},
	}

	// Umwandeln in JSON Bytes
	playloadBytes, _ := json.Marshal(patchData)

	// 2. Patch ausführen
	// types.MergePatchType sorgt dafür, dass nur die angegebenen Felder überschrieben werden
	_, err := m.client.Resource(tenantGVR).Patch(
		ctx,
		name,
		types.MergePatchType,
		playloadBytes,
		metav1.PatchOptions{},
	)

	if err != nil {
		return fmt.Errorf("konnte Quota für %s nicht updaten: %w", name, err)
	}

	fmt.Printf("🆙 Quota für Tenant %s auf %d erhöht.\n", name, newQuota)
	return nil
}

func (m *Manager) ListTenantsByOwner(ctx context.Context, userEmail string) ([]map[string]interface{}, error) {
	list, err := m.client.Resource(tenantGVR).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var formattedTenants []map[string]interface{}

	for _, item := range list.Items {
		// --- 1. Filter Logik ---
		owners, found, _ := unstructured.NestedSlice(item.Object, "spec", "owners")
		if !found {
			continue
		}

		isOwner := false
		for _, owner := range owners {
			if ownerMap, ok := owner.(map[string]interface{}); ok {
				if ownerMap["name"] == userEmail {
					isOwner = true
					break
				}
			}
		}

		if !isOwner {
			continue
		}

		// --- 2. Formatierung (direkt hier) ---
		name := item.GetName()
		status, _, _ := unstructured.NestedMap(item.Object, "status")

		// Status Felder
		state, _ := status["state"].(string)
		// Capsule setzt oft Conditions. Wir prüfen hier das 'ready' Feld einfach direkt
		readyStr, _ := status["ready"].(string)

		nsCount, _, _ := unstructured.NestedInt64(status, "namespaceCount")
		nsQuota, _, _ := unstructured.NestedInt64(item.Object, "spec", "namespaceOptions", "quota")

		formattedTenants = append(formattedTenants, map[string]interface{}{
			"id":    name,
			"name":  name,
			"state": state,
			"ready": readyStr == "True",
			"usage": map[string]interface{}{
				"current": nsCount,
				"max":     nsQuota,
			},
			"position": map[string]interface{}{
				"x": 100,
				"y": 100,
			},
		})
	}

	return formattedTenants, nil
}
