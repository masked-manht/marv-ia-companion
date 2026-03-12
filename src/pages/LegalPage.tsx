import React from "react";
import { ArrowLeft, Mail, Shield, FileText, Scale } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function LegalPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-lg">
        <button onClick={() => navigate(-1)} className="text-primary"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-lg font-semibold flex-1">Mentions Légales</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Éditeur */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <Scale className="w-5 h-5" />
            <h2 className="text-base font-bold">Éditeur de l'application</h2>
          </div>
          <div className="bg-secondary rounded-xl border border-border p-4 space-y-2 text-sm text-muted-foreground">
            <p><span className="font-medium text-foreground">Application :</span> Marv-IA</p>
            <p><span className="font-medium text-foreground">Version :</span> 1.1.0</p>
            <p><span className="font-medium text-foreground">Éditeur :</span> IFAQ Ideas</p>
            <p><span className="font-medium text-foreground">Développeur :</span> Marvens Zamy</p>
            <p><span className="font-medium text-foreground">Contact :</span> ifaqideas@gmail.com</p>
          </div>
        </section>

        {/* Hébergement */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="w-5 h-5" />
            <h2 className="text-base font-bold">Hébergement</h2>
          </div>
          <div className="bg-secondary rounded-xl border border-border p-4 text-sm text-muted-foreground space-y-1">
            <p>L'application est hébergée par <span className="font-medium text-foreground">Lovable Cloud</span>.</p>
            <p>Les données sont stockées sur des serveurs sécurisés avec chiffrement en transit et au repos.</p>
          </div>
        </section>

        {/* Propriété intellectuelle */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="w-5 h-5" />
            <h2 className="text-base font-bold">Propriété intellectuelle</h2>
          </div>
          <div className="bg-secondary rounded-xl border border-border p-4 text-sm text-muted-foreground space-y-2">
            <p>L'ensemble du contenu de l'application Marv-IA (textes, logos, interfaces, code source) est protégé par le droit d'auteur et appartient à IFAQ Ideas / Marvens Zamy.</p>
            <p>Toute reproduction, modification ou distribution sans autorisation préalable est strictement interdite.</p>
          </div>
        </section>

        {/* Responsabilité */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">Limitation de responsabilité</h2>
          <div className="bg-secondary rounded-xl border border-border p-4 text-sm text-muted-foreground space-y-2">
            <p>Marv-IA utilise des modèles d'intelligence artificielle qui peuvent produire des résultats imprécis. L'utilisateur est responsable de la vérification des informations fournies.</p>
            <p>L'éditeur ne saurait être tenu responsable des dommages directs ou indirects résultant de l'utilisation de l'application.</p>
          </div>
        </section>

        {/* Contact / Support */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">Support & Contact</h2>
          <a
            href="mailto:ifaqideas@gmail.com"
            className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl p-4 hover:bg-primary/15 transition-colors"
          >
            <Mail className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Contactez-nous</p>
              <p className="text-xs text-muted-foreground">ifaqideas@gmail.com</p>
            </div>
          </a>
        </section>
      </div>
    </div>
  );
}
