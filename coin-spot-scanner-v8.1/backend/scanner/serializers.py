from rest_framework import serializers
from .models import Candidate, ChecklistProfile, Notification, ScanRun, ScanStepRun, StepSchedule

class StepScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = StepSchedule
        fields = ["id","step_key","sequence","auto_enabled","interval_minutes","total_scan_policy","notify_on_complete","last_run_at","next_run_at"]
        read_only_fields = ["last_run_at","next_run_at"]

class ChecklistProfileSerializer(serializers.ModelSerializer):
    step_schedules = StepScheduleSerializer(many=True, read_only=True)

    def validate_config(self, config):
        errors = {}
        q = config.get("quality_weights", {})
        e = config.get("entry_weights", {})
        opp = config.get("opportunity", {})
        universe = config.get("universe", {})
        if sum(q.values()) != 100:
            errors["quality_weights"] = "Tổng trọng số Quality phải bằng 100."
        if sum(e.values()) != 100:
            errors["entry_weights"] = "Tổng trọng số Entry phải bằng 100."
        if abs(float(opp.get("quality_exponent", 0)) + float(opp.get("entry_exponent", 0)) - 1.0) > 1e-9:
            errors["opportunity"] = "Hai exponent Opportunity phải cộng bằng 1."
        if universe.get("market_cap_min_usd", 0) > universe.get("market_cap_max_usd", 0):
            errors["market_cap"] = "MC tối thiểu không được lớn hơn MC tối đa."
        if universe.get("execution_verification_count", 0) > universe.get("research_shortlist_count", 0):
            errors["execution_verification_count"] = "Execution Verification không được lớn hơn Research Shortlist."
        if errors:
            raise serializers.ValidationError(errors)
        return config

    def validate(self, attrs):
        if self.instance and self.instance.is_default and ("config" in attrs or "name" in attrs):
            raise serializers.ValidationError("Cấu hình V8.1 mặc định bị khóa. Hãy sao chép để chỉnh sửa.")
        return attrs

    class Meta:
        model = ChecklistProfile
        fields = ["id","name","slug","version","is_default","is_active","config","checksum","step_schedules","created_at","updated_at"]
        read_only_fields = ["slug","version","is_default","checksum","created_at","updated_at"]

class CandidateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidate
        fields = "__all__"

class ScanStepRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScanStepRun
        fields = ["id","step_key","sequence","status","progress","message","policy","payload","started_at","finished_at"]

class ScanRunSerializer(serializers.ModelSerializer):
    steps = ScanStepRunSerializer(many=True, read_only=True)
    candidates = CandidateSerializer(many=True, read_only=True)
    profile_name = serializers.CharField(source="profile.name", read_only=True)
    class Meta:
        model = ScanRun
        fields = ["id","profile","profile_name","mode_requested","mode_validated","status","current_step","progress","counters","results","validation","error_message","started_at","finished_at","created_at","steps","candidates"]

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"
