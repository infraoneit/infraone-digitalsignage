# InfraOne Digital Signage Website

Landingpage & Whitepaper für **InfraOne Digital Signage** – Werbebildschirme ohne Abo.

---

## 📂 Ordnerstruktur

infraone-digitalsignage/
│── index.html # Hauptseite (Landingpage)
│── assets/
│ ├── images/ # Bilder für die Website
│ │ ├── screen1.jpg
│ │ ├── screen2.jpg
│ │ └── ...
│ └── pdf/
│ └── whitepaper_infraone-digitalsignage.pdf
│── whitepaper/
│ └── index.html # Whitepaper als HTML
│── README.md # Diese Anleitung

yaml
Code kopieren

---

## 🚀 Deployment

### 1. Repository einrichten

```bash
cd pfad/zu/infraone-digitalsignage
git init
git add .
git commit -m "Initial commit - InfraOne Digital Signage Website"
git branch -M main
git remote add origin https://github.com/infraoneit/infraone-digitalsignage.git
git push -u origin main