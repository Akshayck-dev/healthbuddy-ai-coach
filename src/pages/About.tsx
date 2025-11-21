import { Card, CardContent } from "@/components/ui/card";
import { Heart, Globe, Shield, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

const About = () => {
  const values = [
    {
      icon: <Heart className="w-8 h-8 text-primary" />,
      title: "Our Mission",
      description:
        "To simplify fitness for everyone by providing intelligent, personalized wellness guidance that adapts to your lifestyle and language preferences.",
    },
    {
      icon: <Globe className="w-8 h-8 text-primary" />,
      title: "Bilingual Support",
      description:
        "We believe health guidance should be in your native language. That's why HealthBuddy speaks both English and Malayalam fluently.",
    },
    {
      icon: <Shield className="w-8 h-8 text-primary" />,
      title: "AI-Powered Personalization",
      description:
        "Our advanced AI creates customized calorie and protein plans based on your unique body type, goals, and preferences.",
    },
    {
      icon: <Users className="w-8 h-8 text-primary" />,
      title: "Safety First",
      description:
        "HealthBuddy provides general wellness guidance only. Always consult healthcare professionals for medical advice and treatment.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <WhatsAppButton />

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 fade-up">
            <h1 className="text-5xl font-bold mb-4">About HealthBuddy</h1>
            <p className="text-xl text-muted-foreground">
              Your trusted AI companion for a healthier lifestyle
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {values.map((value, index) => (
              <Card
                key={index}
                className="fade-up wellness-shadow"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    {value.icon}
                  </div>
                  <h3 className="text-xl font-semibold">{value.title}</h3>
                  <p className="text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="fade-up wellness-shadow">
            <CardContent className="p-8 space-y-6">
              <h2 className="text-3xl font-bold">How We Help You</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Personalized Nutrition Plans</h3>
                  <p className="text-muted-foreground">
                    Our AI analyzes your body metrics, lifestyle, and goals to create customized
                    meal plans that include Kerala-friendly options and local cuisine.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-2">Smart Calorie Tracking</h3>
                  <p className="text-muted-foreground">
                    Get accurate calorie and protein recommendations based on scientific
                    calculations tailored to your body type and fitness objectives.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-2">Home Workout Guidance</h3>
                  <p className="text-muted-foreground">
                    Access effective workout routines you can do at home, no equipment needed.
                    Perfect for busy schedules and any fitness level.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-2">Continuous Support</h3>
                  <p className="text-muted-foreground">
                    Our AI coach is available 24/7 to answer questions, provide motivation,
                    and adjust your plan as you progress towards your goals.
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <h3 className="text-xl font-semibold mb-2 text-destructive">Important Safety Note</h3>
                <p className="text-muted-foreground">
                  HealthBuddy provides general wellness guidance and educational information
                  only. This is not medical advice, diagnosis, or treatment. Always consult
                  with qualified healthcare professionals before making significant changes
                  to your diet or exercise routine, especially if you have existing health
                  conditions or concerns.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default About;
