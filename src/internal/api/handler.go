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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
