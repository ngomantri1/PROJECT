from django.contrib import admin
from .models import Candidate, ChecklistProfile, Notification, ScanRun, ScanStepRun, StepSchedule

admin.site.register(ChecklistProfile)
admin.site.register(StepSchedule)
admin.site.register(ScanRun)
admin.site.register(ScanStepRun)
admin.site.register(Candidate)
admin.site.register(Notification)
