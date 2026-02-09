import { LeftSidebar } from "@/components/layout/LeftSidebar";

export default function MessagesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="max-w-[1265px] mx-auto flex justify-center min-h-screen">
            <LeftSidebar />
            <main className="w-full max-w-[990px] border-x border-border-gray min-h-screen flex">
                {children}
            </main>
        </div>
    );
}
