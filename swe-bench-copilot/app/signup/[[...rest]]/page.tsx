import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center py-16">
      <SignUp />
    </main>
  );
}
