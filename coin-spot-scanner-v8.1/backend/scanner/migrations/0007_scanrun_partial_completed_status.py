from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scanner", "0006_unlockofficialschedule_confidence_and_more")]

    operations = [
        migrations.AlterField(
            model_name="scanrun",
            name="status",
            field=models.CharField(
                choices=[
                    ("QUEUED", "QUEUED"),
                    ("RUNNING", "RUNNING"),
                    ("PAUSED", "PAUSED"),
                    ("COMPLETED", "COMPLETED"),
                    ("COMPLETED_WITH_WARNINGS", "COMPLETED_WITH_WARNINGS"),
                    ("PARTIAL_COMPLETED", "PARTIAL_COMPLETED"),
                    ("FAILED", "FAILED"),
                    ("CANCELLED", "CANCELLED"),
                ],
                default="QUEUED",
                max_length=32,
            ),
        ),
    ]
