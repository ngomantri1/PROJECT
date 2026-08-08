from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("scanner", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="MarketRegimeGlobalSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(max_length=40)),
                ("observed_at", models.DateTimeField()),
                ("fetched_at", models.DateTimeField()),
                ("btc_dominance_pct", models.DecimalField(decimal_places=4, max_digits=8)),
                ("eth_dominance_pct", models.DecimalField(blank=True, decimal_places=4, max_digits=8, null=True)),
                ("total_market_cap_usd", models.DecimalField(decimal_places=4, max_digits=30)),
                ("total3_proxy_usd", models.DecimalField(blank=True, decimal_places=4, max_digits=30, null=True)),
                ("source_endpoint", models.CharField(max_length=255)),
                ("payload_hash", models.CharField(max_length=64)),
            ],
        ),
        migrations.AddConstraint(model_name="marketregimeglobalsnapshot", constraint=models.UniqueConstraint(fields=("provider", "observed_at"), name="market_regime_provider_observed_unique")),
        migrations.AddIndex(model_name="marketregimeglobalsnapshot", index=models.Index(fields=["provider", "observed_at"], name="scanner_mar_provider_3c5d38_idx")),
    ]
