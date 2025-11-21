import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Apple,
  Dumbbell,
  Heart,
  TrendingDown,
  Users,
  Zap,
  Globe,
  CalendarCheck,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import heroImage from "@/assets/hero-fitness.jpg";

const Index = () => {
  const features = [
    {
      icon: <Zap className="w-8 h-8 text-primary" />,
      title: "Smart AI Diet Coach",
      description: "Get personalized nutrition plans powered by advanced AI",
    },
    {
      icon: <TrendingDown className="w-8 h-8 text-primary" />,
      title: "Weight Loss & Gain Plans",
      description: "Tailored programs for your specific health goals",
    },
    {
      icon: <Apple className="w-8 h-8 text-primary" />,
      title: "Personalized Calories + Protein",
      description: "Calculate exact nutrition needs for your body type",
    },
    {
      icon: <Heart className="w-8 h-8 text-primary" />,
      title: "Kerala-Friendly Meals",
      description: "Local cuisine-based meal plans that you'll love",
    },
    {
      icon: <Dumbbell className="w-8 h-8 text-primary" />,
      title: "Home Workouts",
      description: "Effective exercises you can do anywhere, anytime",
    },
    {
      icon: <Globe className="w-8 h-8 text-primary" />,
      title: "Bilingual Support",
      description: "Chat in English or Malayalam - your choice!",
    },
  ];

  const steps = [
    {
      number: "1",
      title: "Choose Language",
      description: "Select English or Malayalam to start your journey",
    },
    {
      number: "2",
      title: "Select Goal",
      description: "Tell us if you want weight loss or gain",
    },
    {
      number: "3",
      title: "Get Your Plan",
      description: "Receive AI-personalized diet & fitness plan",
    },
  ];

  const successStories = [
    {
      name: "Rahul K.",
      result: "Lost 12 kg in 3 months",
      description: "HealthBuddy's Kerala meal plans made it so easy!",
    },
    {
      name: "Priya S.",
      result: "Gained 5 kg healthy weight",
      description: "Finally found a plan that works for vegetarians",
    },
    {
      name: "Arun M.",
      result: "Maintained fitness goal",
      description: "Home workouts fit perfectly into my schedule",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <WhatsAppButton />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 fade-up">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
              Health
              <span className="text-primary">Buddy</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground">
              Your bilingual AI diet & fitness assistant
            </p>
            <p className="text-lg text-muted-foreground">
              Get personalized meal plans, calorie tracking, and workout guidance in
              English or Malayalam. Smart wellness made simple.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button asChild size="lg" className="wellness-gradient text-lg px-8">
                <Link to="/chat">Start Now</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-8">
                <Link to="/chat">Choose Language</Link>
              </Button>
            </div>
          </div>
          <div className="fade-up">
            <img
              src={heroImage}
              alt="Fitness and wellness lifestyle"
              className="rounded-3xl wellness-shadow w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12 fade-up">
          <h2 className="text-4xl font-bold mb-4">Why Choose HealthBuddy?</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need for a healthier lifestyle, powered by AI
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="fade-up wellness-shadow hover:wellness-glow transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-6 space-y-3">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 fade-up">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started in three simple steps
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div
                key={index}
                className="fade-up text-center space-y-4"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <div className="w-16 h-16 rounded-full wellness-gradient text-primary-foreground text-2xl font-bold flex items-center justify-center mx-auto wellness-glow">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12 fade-up">
          <h2 className="text-4xl font-bold mb-4">Success Stories</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Real results from real people
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {successStories.map((story, index) => (
            <Card
              key={index}
              className="fade-up wellness-shadow"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-6 space-y-3 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{story.name}</h3>
                <p className="text-2xl font-bold text-primary">{story.result}</p>
                <p className="text-muted-foreground">"{story.description}"</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-secondary text-secondary-foreground py-16">
        <div className="container mx-auto px-4 text-center fade-up">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Health?</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto opacity-90">
            Start your personalized wellness journey today with HealthBuddy AI
          </p>
          <Button asChild size="lg" className="wellness-gradient text-lg px-8">
            <Link to="/chat">
              <CalendarCheck className="w-5 h-5 mr-2" />
              Get Started Free
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
