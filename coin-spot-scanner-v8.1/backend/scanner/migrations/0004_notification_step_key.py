from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scanner", "0003_rename_scanner_can_scan_ru_7f07c5_idx_scanner_can_scan_ru_faea4b_idx_and_more")]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="step_key",
            field=models.CharField(blank=True, max_length=40),
        ),
    ]
