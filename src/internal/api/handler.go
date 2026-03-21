package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/giulian-coding/kubervise/internal/capsule"
)

type TenantHandler struct {
	Manager *capsule.Manager
}

func (h *TenantHandler) CreateTenant(c *gin.Context) {
	var input struct {
		Name  string `json:"name"`
		Owner string `json:"owner"`
	}

	// JSON vom Frontend einlesen
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ungültiges JSON: " + err.Error()})
		return
	}

	// Falls der Owner nicht im JSON-Body war, nehmen wir den Header
	if input.Owner == "" {
		input.Owner = c.GetHeader("X-User-Email")
	}

	// Wenn wir immer noch keinen Owner haben, brechen wir ab
	if input.Owner == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No User Email provided (neither in JSON nor in Header)"})
		return
	}

	// Deinen bestehenden Manager nutzen!
	err := h.Manager.CreateTenant(c.Request.Context(), input.Name, input.Owner)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Tenant erstellt"})
}

func (h *TenantHandler) ListMyTenants(c *gin.Context) {
	userEmail := c.GetHeader("X-User-Email")
	if userEmail == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No User Email provided in Header 'X-User-Email'"})
		return
	}

	tenants, err := h.Manager.ListTenantsByOwner(c.Request.Context(), userEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tenants)
}

// Namespaces

func (h *TenantHandler) ListNamespaces(c *gin.Context) {
	tenantName := c.Param("tenantName")
	if tenantName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenantName fehlt"})
		return
	}

	namespaces, err := h.Manager.ListNamespaces(c.Request.Context(), tenantName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, namespaces)
}

func (h *TenantHandler) CreateNamespace(c *gin.Context) {
	tenantName := c.Param("tenantName")

	var input struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ungültiges JSON: " + err.Error()})
		return
	}

	err := h.Manager.CreateNamespace(c.Request.Context(), input.Name, tenantName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Namespace erfolgreich erstellt"})
}

func (h *TenantHandler) DeleteNamespace(c *gin.Context) {
	namespaceName := c.Param("namespaceName")

	if err := h.Manager.DeleteNamespace(c.Request.Context(), namespaceName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Namespace wird gelöscht"})
}

// --- Deployments & Pods ---

func (h *TenantHandler) CreateDeployment(c *gin.Context) {
	namespaceName := c.Param("namespaceName")

	var input struct {
		Name  string `json:"name"`
		Image string `json:"image"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ungültiges JSON: " + err.Error()})
		return
	}

	if err := h.Manager.CreateDeployment(c.Request.Context(), namespaceName, input.Name, input.Image); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Deployment erfolgreich erstellt"})
}

func (h *TenantHandler) ListDeployments(c *gin.Context) {
	namespaceName := c.Param("namespaceName")

	deployments, err := h.Manager.ListDeployments(c.Request.Context(), namespaceName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, deployments)
}

func (h *TenantHandler) DeleteDeployment(c *gin.Context) {
	namespaceName := c.Param("namespaceName")
	deploymentName := c.Param("deploymentName")

	if err := h.Manager.DeleteDeployment(c.Request.Context(), namespaceName, deploymentName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deployment wird gelöscht"})
}

func (h *TenantHandler) ListPods(c *gin.Context) {
	namespaceName := c.Param("namespaceName")

	pods, err := h.Manager.ListPods(c.Request.Context(), namespaceName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, pods)
}

// --- Services ---

func (h *TenantHandler) CreateService(c *gin.Context) {
	namespaceName := c.Param("namespaceName")

	var input struct {
		Name        string `json:"name"`
		AppName     string `json:"appName"`     // Welches Deployment soll verknüpft werden?
		Port        int    `json:"port"`        // Nach außen freigegebener Port (z.B. 80)
		TargetPort  int    `json:"targetPort"`  // Interner Port des Containers (z.B. 80)
		ServiceType string `json:"serviceType"` // Optional: "NodePort", "LoadBalancer", oder "ClusterIP"
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ungültiges JSON: " + err.Error()})
		return
	}

	if err := h.Manager.CreateService(c.Request.Context(), namespaceName, input.Name, input.AppName, input.Port, input.TargetPort, input.ServiceType); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Service erfolgreich erstellt"})
}

func (h *TenantHandler) ListServices(c *gin.Context) {
	namespaceName := c.Param("namespaceName")

	services, err := h.Manager.ListServices(c.Request.Context(), namespaceName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, services)
}

func (h *TenantHandler) DeleteService(c *gin.Context) {
	namespaceName := c.Param("namespaceName")
	serviceName := c.Param("serviceName")

	if err := h.Manager.DeleteService(c.Request.Context(), namespaceName, serviceName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Service wird gelöscht"})
}

// --- NetworkPolicies ---

func (h *TenantHandler) CreateNetworkPolicy(c *gin.Context) {
	targetNamespace := c.Param("namespaceName")

	var input struct {
		Name            string `json:"name"`
		SourceNamespace string `json:"sourceNamespace"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ungültiges JSON: " + err.Error()})
		return
	}

	if err := h.Manager.CreateNetworkPolicy(c.Request.Context(), targetNamespace, input.Name, input.SourceNamespace); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "NetworkPolicy erfolgreich erstellt - Namespaces sind verbunden!"})
}

func (h *TenantHandler) ListNetworkPolicies(c *gin.Context) {
	namespaceName := c.Param("namespaceName")

	policies, err := h.Manager.ListNetworkPolicies(c.Request.Context(), namespaceName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, policies)
}

func (h *TenantHandler) DeleteNetworkPolicy(c *gin.Context) {
	namespaceName := c.Param("namespaceName")
	policyName := c.Param("policyName")

	if err := h.Manager.DeleteNetworkPolicy(c.Request.Context(), namespaceName, policyName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "NetworkPolicy wird gelöscht - Verbindung getrennt"})
}
