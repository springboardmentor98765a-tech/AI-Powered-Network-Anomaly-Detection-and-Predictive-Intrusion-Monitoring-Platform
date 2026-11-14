# NetShield AI — Anomaly Detection Report

- Trained at: 2026-11-14T09:52:49+00:00
- Data source: Synthetic (CICIDS-style)
- Rows used: 30,000 (train 22,500 / test 7,500)
- Selected classifier: **RandomForest**

## Model comparison

| Model | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|
| RandomForest | 0.9951 | 0.9895 | 0.9918 | 0.9906 |

## Isolation Forest (anomaly detector)

Detection rate 0.6681, false positive rate 0.0238, F1 0.7803

## Final system (attack vs normal)

Threat detection rate 0.9943, false positive rate 0.0043

## Per-class results

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| BENIGN | 0.997 | 0.996 | 0.996 | 4879 |
| Botnet | 1.000 | 1.000 | 1.000 | 308 |
| BruteForce | 0.998 | 1.000 | 0.999 | 525 |
| DDoS | 1.000 | 1.000 | 1.000 | 782 |
| PortScan | 1.000 | 1.000 | 1.000 | 649 |
| WebAttack | 0.942 | 0.955 | 0.949 | 357 |
