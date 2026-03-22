package capsule

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// CreateTenantObject baut das Unstructured-Objekt für Capsule
func CreateTenantObject(name string, owner string) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "capsule.clastix.io/v1beta2",
			"kind":       "Tenant",
			"metadata": map[string]interface{}{
				"name": name,
				"labels": map[string]interface{}{
					"capsule-isolation": "enabled",
				},
			},
			"spec": map[string]interface{}{
				"owners": []interface{}{
					map[string]interface{}{
						"name": owner,
						"kind": "User",
					},
				},
				"namespaceOptions": map[string]interface{}{
					"quota": int64(5),
					"allowedNamespaces": map[string]interface{}{
						"regex": fmt.Sprintf("^%s-.*$", name), // Zwingt den User, Namespaces mit "tenantname-" zu beginnen
					},
				},
			},
		},
	}
}
