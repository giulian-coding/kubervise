package capsule

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var serviceGVR = schema.GroupVersionResource{
	Group:    "", // Core API
	Version:  "v1",
	Resource: "services",
}

// CreateService erstellt einen Service, der den Traffic an ein Deployment weiterleitet
func (m *Manager) CreateService(ctx context.Context, namespace, name, appName string, port, targetPort int, serviceType string) error {
	if serviceType == "" {
		serviceType = "NodePort" // NodePort ist super für lokale Tests, LoadBalancer für Cloud
	}

	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "v1",
			"kind":       "Service",
			"metadata": map[string]interface{}{
				"name":      name,
				"namespace": namespace,
			},
			"spec": map[string]interface{}{
				"selector": map[string]interface{}{
					"app": appName, // WICHTIG: Verbindet den Service mit den Pods des Deployments
				},
				"type": serviceType,
				"ports": []interface{}{
					map[string]interface{}{
						"port":       int64(port),       // Port, der nach außen freigegeben wird
						"targetPort": int64(targetPort), // Port, auf dem der Container intern lauscht (z.B. 80 bei Nginx)
					},
				},
			},
		},
	}

	_, err := m.client.Resource(serviceGVR).Namespace(namespace).Create(ctx, obj, metav1.CreateOptions{})
	if err != nil {
		return fmt.Errorf("fehler beim Erstellen des Services %s: %w", name, err)
	}
	return nil
}

// ListServices listet alle Services im angegebenen Namespace auf
func (m *Manager) ListServices(ctx context.Context, namespace string) ([]map[string]interface{}, error) {
	list, err := m.client.Resource(serviceGVR).Namespace(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var formattedServices []map[string]interface{}
	for _, item := range list.Items {
		clusterIP, _, _ := unstructured.NestedString(item.Object, "spec", "clusterIP")
		svcType, _, _ := unstructured.NestedString(item.Object, "spec", "type")

		// Ports auslesen
		ports, _, _ := unstructured.NestedSlice(item.Object, "spec", "ports")
		var portList []map[string]interface{}
		for _, p := range ports {
			if pMap, ok := p.(map[string]interface{}); ok {
				portList = append(portList, map[string]interface{}{
					"port":       pMap["port"],
					"targetPort": pMap["targetPort"],
					"nodePort":   pMap["nodePort"], // Wichtig für NodePort-Services
				})
			}
		}

		formattedServices = append(formattedServices, map[string]interface{}{
			"id":        item.GetName(),
			"name":      item.GetName(),
			"type":      svcType,
			"clusterIP": clusterIP,
			"ports":     portList,
		})
	}
	return formattedServices, nil
}

// DeleteService löscht einen Service
func (m *Manager) DeleteService(ctx context.Context, namespace, name string) error {
	err := m.client.Resource(serviceGVR).Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil {
		return fmt.Errorf("fehler beim Löschen des Services %s: %w", name, err)
	}
	return nil
}
