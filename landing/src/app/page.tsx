import Download from "@/components/download";
import FeatureSection from "@/components/feature-section";
import Footer from "@/components/footer";
import Hero from "@/components/hero";
import MoreGrid from "@/components/more-grid";
import Nav from "@/components/nav";
import Statement from "@/components/statement";
import Toolchain from "@/components/toolchain";
import AgentsVisual from "@/components/visuals/agents-visual";
import InboxVisual from "@/components/visuals/inbox-visual";
import ProjectsVisual from "@/components/visuals/projects-visual";
import SecurityVisual from "@/components/visuals/security-visual";
import { sections } from "@/content/site";

const visuals = [AgentsVisual, InboxVisual, ProjectsVisual, SecurityVisual];

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Toolchain />
        <Statement />
        {sections.map((section, i) => {
          const Visual = visuals[i];
          return (
            <FeatureSection key={section.id} section={section}>
              <Visual />
            </FeatureSection>
          );
        })}
        <MoreGrid />
        <Download />
      </main>
      <Footer />
    </>
  );
}
