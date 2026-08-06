from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ChecklistProfileViewSet, ScanRunViewSet, dashboard, health, update_step_schedule

router = DefaultRouter()
router.register("profiles", ChecklistProfileViewSet, basename="profile")
router.register("scan-runs", ScanRunViewSet, basename="scan-run")

urlpatterns = [
    path("health/", health),
    path("dashboard/", dashboard),
    path("step-schedules/<int:pk>/", update_step_schedule),
    path("", include(router.urls)),
]
