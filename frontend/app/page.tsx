import { AskForm } from "@/components/ai-agent/ask-form";
import PageContainer from "@/components/PageContainer";

export default function Home() {
  return (
    <PageContainer>
      <div className="w-full max-w-2xl space-y-4">
        <AskForm />
      </div>
    </PageContainer>
  );
}
