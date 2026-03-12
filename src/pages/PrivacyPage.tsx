import React from "react";
import { ArrowLeft, Shield, Eye, Database, Trash2, Lock, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PrivacyPage() {
  const navigate = useNavigate();

  const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-primary">
        <Icon className="w-5 h-5" />
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      <div className="bg-secondary rounded-xl border border-border p-4 text-sm text-muted-foreground space-y-2">
        {children}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-lg">
        <button onClick={() => navigate(-1)} className="text-primary"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-lg font-semibold flex-1">Politique de Confidentialité</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        <p className="text-sm text-muted-foreground">Dernière mise à jour : Mars 2026</p>

        <Section icon={Eye} title="Données collectées">
          <p>Marv-IA collecte les données suivantes :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><span className="font-medium text-foreground">Email</span> — pour l'authentification et l'identification du compte</li>
            <li><span className="font-medium text-foreground">Conversations</span> — stockées de manière sécurisée et liées à votre compte</li>
            <li><span className="font-medium text-foreground">Mémoire IA</span> — préférences et informations que vous partagez volontairement</li>
            <li><span className="font-medium text-foreground">Images envoyées</span> — traitées pour l'analyse et non conservées après traitement</li>
            <li><span className="font-medium text-foreground">Localisation</span> — uniquement sur demande explicite, jamais en arrière-plan</li>
          </ul>
        </Section>

        <Section icon={Database} title="Utilisation des données">
          <p>Vos données sont utilisées exclusivement pour :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Fournir les fonctionnalités de l'application (chat, génération d'images, recherche)</li>
            <li>Personnaliser vos interactions grâce à la mémoire adaptative</li>
            <li>Améliorer la qualité du service</li>
          </ul>
          <p className="font-medium text-foreground mt-2">Vos données ne sont jamais vendues, partagées ou utilisées à des fins publicitaires.</p>
        </Section>

        <Section icon={Lock} title="Sécurité">
          <p>Nous mettons en œuvre des mesures de sécurité robustes :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Chiffrement des données en transit (TLS/HTTPS)</li>
            <li>Chiffrement des données au repos</li>
            <li>Authentification sécurisée avec vérification par email</li>
            <li>Isolation des données par utilisateur (Row Level Security)</li>
            <li>Aucun accès tiers à vos conversations</li>
          </ul>
        </Section>

        <Section icon={Trash2} title="Vos droits">
          <p>Conformément aux lois en vigueur, vous avez le droit de :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><span className="font-medium text-foreground">Accéder</span> à vos données personnelles</li>
            <li><span className="font-medium text-foreground">Supprimer</span> vos conversations et votre mémoire IA (dans Paramètres)</li>
            <li><span className="font-medium text-foreground">Rectifier</span> vos informations</li>
            <li><span className="font-medium text-foreground">Exporter</span> vos données</li>
            <li><span className="font-medium text-foreground">Supprimer</span> votre compte en nous contactant</li>
          </ul>
        </Section>

        <Section icon={Shield} title="Cookies et stockage local">
          <p>Marv-IA utilise le stockage local du navigateur (localStorage) pour :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Sauvegarder vos préférences (thème, langue, paramètres)</li>
            <li>Maintenir votre session d'authentification</li>
            <li>Stocker temporairement les fichiers IDE</li>
          </ul>
          <p>Aucun cookie tiers ni traceur publicitaire n'est utilisé.</p>
        </Section>

        {/* Contact */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-foreground">Questions ?</h2>
          <a
            href="mailto:ifaqideas@gmail.com"
            className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl p-4 hover:bg-primary/15 transition-colors"
          >
            <Mail className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Contactez notre support</p>
              <p className="text-xs text-muted-foreground">ifaqideas@gmail.com</p>
            </div>
          </a>
        </section>
      </div>
    </div>
  );
}
