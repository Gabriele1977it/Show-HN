import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center py-16">
      <SignIn />
    </main>
  );
}
