from django.contrib import admin
from .models import Candidate, ChecklistProfile, Notification, ScanRun, ScanStepRun, StepSchedule, UnlockOfficialSchedule, UnlockProviderSnapshot

admin.site.register(ChecklistProfile)
admin.site.register(StepSchedule)
admin.site.register(ScanRun)
admin.site.register(ScanStepRun)
admin.site.register(Candidate)
admin.site.register(Notification)

@admin.register(UnlockOfficialSchedule)
class UnlockOfficialScheduleAdmin(admin.ModelAdmin):
    list_display = ("coingecko_id", "symbol", "project_name", "verification_state", "evidence_type", "confidence", "coverage_end", "is_active")
    list_filter = ("verification_state", "evidence_type", "confidence", "is_active")
    search_fields = ("coingecko_id", "symbol", "project_name", "contract")
    readonly_fields = ("payload_hash",)

@admin.register(UnlockProviderSnapshot)
class UnlockProviderSnapshotAdmin(admin.ModelAdmin):
    list_display = ("identity_key", "provider", "status", "confidence", "fetched_at", "expires_at")
    list_filter = ("provider", "status", "confidence")
    search_fields = ("identity_key", "provider")
