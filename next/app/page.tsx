import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ServerIcon,
  ShieldCheckIcon,
  ActivityIcon,
  ZapIcon,
  LayersIcon,
  BellIcon,
  ArrowRightIcon,
  CheckIcon,
  GithubIcon,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <ServerIcon className="size-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">Kubervise</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link
              href="#features"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              How it works
            </Link>
            <Link
              href="#pricing"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        <div className="mx-auto max-w-6xl px-4 py-24 text-center md:py-32">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            <span className="flex size-2 animate-pulse rounded-full bg-green-500" />
            Now with real-time monitoring
          </div>
          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
            Kubernetes Observability{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Made Simple
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Monitor your Kubernetes clusters with ease. Get instant visibility
            into pods, deployments, nodes, and more. No complex setup required.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/auth/sign-up">
              <Button size="lg">
                Start Free Trial
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </Link>
            <Link href="https://github.com/giulian-coding/kubervise" target="_blank">
              <Button variant="outline" size="lg">
                <GithubIcon data-icon="inline-start" />
                View on GitHub
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required. 14-day free trial.
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t border-border/40 bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything you need to monitor Kubernetes
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Comprehensive observability tools designed for modern cloud-native
              infrastructure.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<ActivityIcon className="size-5" />}
              title="Real-time Metrics"
              description="Monitor CPU, memory, and network usage across all your nodes and pods in real-time."
            />
            <FeatureCard
              icon={<LayersIcon className="size-5" />}
              title="Multi-Cluster Support"
              description="Manage and monitor multiple Kubernetes clusters from a single dashboard."
            />
            <FeatureCard
              icon={<BellIcon className="size-5" />}
              title="Smart Alerts"
              description="Get notified instantly when something goes wrong. Configure custom alert rules."
            />
            <FeatureCard
              icon={<ShieldCheckIcon className="size-5" />}
              title="Security Insights"
              description="Track RBAC configurations, secrets, and security policies across your clusters."
            />
            <FeatureCard
              icon={<ZapIcon className="size-5" />}
              title="Quick Setup"
              description="Deploy our agent with a single command. Start monitoring in under 2 minutes."
            />
            <FeatureCard
              icon={<ServerIcon className="size-5" />}
              title="Resource Overview"
              description="Complete visibility into deployments, services, configmaps, and more."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Get started in 3 simple steps
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              From sign-up to full observability in under 5 minutes.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <StepCard
              step={1}
              title="Create your account"
              description="Sign up for free and create your first team workspace."
            />
            <StepCard
              step={2}
              title="Install the agent"
              description="Run a single command to deploy our lightweight agent to your cluster."
            />
            <StepCard
              step={3}
              title="Start monitoring"
              description="Instantly see all your Kubernetes resources in real-time."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="border-t border-border/40 bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Start free, scale as you grow. No hidden fees.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            <PricingCard
              name="Starter"
              price="Free"
              description="Perfect for small projects"
              features={[
                "1 cluster",
                "7-day data retention",
                "Basic alerts",
                "Community support",
              ]}
            />
            <PricingCard
              name="Pro"
              price="$49"
              period="/month"
              description="For growing teams"
              features={[
                "Up to 5 clusters",
                "30-day data retention",
                "Advanced alerts",
                "Email support",
                "Custom dashboards",
              ]}
              highlighted
            />
            <PricingCard
              name="Enterprise"
              price="Custom"
              description="For large organizations"
              features={[
                "Unlimited clusters",
                "90-day data retention",
                "SSO & SAML",
                "24/7 support",
                "On-premise option",
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-background p-8 text-center md:p-16">
            <h2 className="text-3xl font-bold tracking-tight">
              Ready to simplify your Kubernetes monitoring?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Join hundreds of teams who trust Kubervise for their observability
              needs.
            </p>
            <Link href="/auth/sign-up">
              <Button size="lg" className="mt-8">
                Get Started for Free
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-primary">
                <ServerIcon className="size-3 text-primary-foreground" />
              </div>
              <span className="font-semibold">Kubervise</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Kubervise. All rights reserved.
            </p>
            <div className="flex gap-4">
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-xl border border-border/40 bg-card p-6 transition-all hover:border-border hover:shadow-md">
      <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-xl border border-border/40 bg-card p-6 text-center">
      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {step}
        </div>
      </div>
      <h3 className="mb-2 mt-4 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  highlighted,
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl border p-6 ${
        highlighted
          ? "border-primary bg-card shadow-lg"
          : "border-border/40 bg-card"
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            Most Popular
          </span>
        </div>
      )}
      <div className="text-center">
        <h3 className="font-semibold">{name}</h3>
        <div className="mt-4">
          <span className="text-4xl font-bold">{price}</span>
          {period && (
            <span className="text-sm text-muted-foreground">{period}</span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm">
            <CheckIcon className="size-4 text-primary" />
            {feature}
          </li>
        ))}
      </ul>
      <Link href="/auth/sign-up" className="block">
        <Button
          variant={highlighted ? "default" : "outline"}
          className="mt-6 w-full"
        >
          Get Started
        </Button>
      </Link>
    </div>
  );
}
