# NetShield AI — OPTIONAL deep learning anomaly detector (TensorFlow autoencoder)
# Developed by Krish | SKK Projects
"""
Optional extra (the main system does not need it). Install first:  pip install tensorflow
Run:  python -m app.ml.autoencoder

Idea in one line: an autoencoder learns to 'copy' normal traffic. When it sees an attack,
it copies it badly, so a high copy-error (reconstruction error) means 'anomaly'.
"""
import numpy as np
from sklearn.preprocessing import StandardScaler

from app.config import settings
from app.ml.features import clean_dataframe, transform
from app.ml.synthetic import generate_dataset


def main():
    import tensorflow as tf  # imported here so the rest of the project never needs TensorFlow

    df = clean_dataframe(generate_dataset(20_000))
    X = transform(df)
    is_attack = (df["label"] != "BENIGN").values
    scaler = StandardScaler().fit(X[~is_attack])
    X = scaler.transform(X)
    normal, n = X[~is_attack], X.shape[1]

    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(n,)),
        tf.keras.layers.Dense(10, activation="relu"),
        tf.keras.layers.Dense(4, activation="relu"),   # the 'bottleneck'
        tf.keras.layers.Dense(10, activation="relu"),
        tf.keras.layers.Dense(n, activation="linear"),
    ])
    model.compile(optimizer="adam", loss="mse")
    model.fit(normal, normal, epochs=15, batch_size=256, validation_split=0.1, verbose=2)

    errors = np.mean((model.predict(X, verbose=0) - X) ** 2, axis=1)
    threshold = np.percentile(errors[~is_attack], 97.5)
    pred = errors > threshold
    tp, fp = np.sum(pred & is_attack), np.sum(pred & ~is_attack)
    print(f"Detection rate: {tp / is_attack.sum():.3f}  False positive rate: {fp / (~is_attack).sum():.3f}")
    model.save(settings.MODEL_DIR / "autoencoder.keras")


if __name__ == "__main__":
    main()
