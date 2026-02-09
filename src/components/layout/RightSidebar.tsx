export function RightSidebar() {
    return (
        <aside className="w-[350px] hidden lg:flex flex-col gap-4 p-3 sticky top-0 h-screen overflow-y-auto no-scrollbar">
            <div className="sticky top-0 bg-white pb-2 z-10">
                <div className="relative group">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-light !text-[20px] group-focus-within:text-primary">
                        search
                    </span>
                    <input
                        className="w-full bg-[#eff3f4] border-none rounded-full py-3 pl-12 pr-4 focus:ring-1 focus:ring-primary focus:bg-white transition-all text-[15px]"
                        placeholder="Search"
                        type="text"
                    />
                </div>
            </div>
            <section className="bg-[#f7f9fa] rounded-2xl overflow-hidden">
                <h3 className="text-xl font-extrabold px-4 py-3">What's happening</h3>
                <div className="flex flex-col">
                    <div className="px-4 py-3 hover:bg-black/[0.03] transition-colors cursor-pointer">
                        <div className="flex justify-between text-[13px] text-text-light">
                            <span>Trending in Technology</span>
                            <span className="material-symbols-outlined !text-[18px]">
                                more_horiz
                            </span>
                        </div>
                        <p className="font-bold text-[15px]">#WebDev2024</p>
                        <p className="text-[13px] text-text-light">12.5K posts</p>
                    </div>
                    <div className="px-4 py-3 hover:bg-black/[0.03] transition-colors cursor-pointer">
                        <div className="flex justify-between text-[13px] text-text-light">
                            <span>Design · Trending</span>
                            <span className="material-symbols-outlined !text-[18px]">
                                more_horiz
                            </span>
                        </div>
                        <p className="font-bold text-[15px]">Figma AI</p>
                        <p className="text-[13px] text-text-light">5,821 posts</p>
                    </div>
                    <div className="px-4 py-3 hover:bg-black/[0.03] transition-colors cursor-pointer">
                        <div className="flex justify-between text-[13px] text-text-light">
                            <span>Entertainment · Trending</span>
                            <span className="material-symbols-outlined !text-[18px]">
                                more_horiz
                            </span>
                        </div>
                        <p className="font-bold text-[15px]">#TheLastOfUs</p>
                        <p className="text-[13px] text-text-light">45K posts</p>
                    </div>
                    <button className="text-primary text-[15px] p-4 text-left hover:bg-black/[0.03] transition-colors">
                        Show more
                    </button>
                </div>
            </section>
            <section className="bg-[#f7f9fa] rounded-2xl overflow-hidden">
                <h3 className="text-xl font-extrabold px-4 py-3">Who to follow</h3>
                <div className="flex flex-col">
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.03] transition-colors cursor-pointer">
                        <div
                            className="w-10 h-10 rounded-full bg-cover bg-center"
                            style={{
                                backgroundImage:
                                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDjrb9wqc1laq0I-KSdwIdLuZ045BVBt98QhfwvwDj3xQO6sKwW8TzVO4C9Z6x3z40STRTl8tDEd2XYe6cSB9GouxR2DRBgFgLYmnyDibRuDD5ZU1OnQrnimCAbxOzJa2xnZfzn4gS-rTnt1dhsIOoKuLkg4dkzD-rO2sLSEqTRQci7XE2hY91o3lRik7cWOlP1TumhyIcd4g5SNYUMHEJDei8i1goxejXojYpJyc7yB7o9w8xtR54oIzZkGdLmJS5bwvdx7sAEieDk')",
                            }}
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-bold truncate text-[15px]">
                                Elena Rodriguez
                            </span>
                            <span className="text-text-light text-[15px] truncate">
                                @erodriguez
                            </span>
                        </div>
                        <button className="bg-[#0f1419] text-white px-4 py-1.5 rounded-full text-[14px] font-bold">
                            Follow
                        </button>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.03] transition-colors cursor-pointer">
                        <div
                            className="w-10 h-10 rounded-full bg-cover bg-center"
                            style={{
                                backgroundImage:
                                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDvQfwAsMWplKuoYCcc4GVJ5FYR849Y8SocXb6EgO1Mm359w0Miqnr98R_fHlpjmp5eMq0fTCQI5iGh4UmFm7x2LYXBoOI5pQhDFqNF7ovLMCBgRv9SM3qKvAFRXzerfOLwul912D1c98WE2xFOa7g9-Lc40ytwgh3tT9UvFCnt6R4W3gtHkuGTLMhag6aqiQqPQdWlGOsNHD_Jto1g7I-Hu5vGoKLC2GR3lCZkuO4LUMxjjCfnXR5qpKfUE67yoFKSIq_qcVRi09Qv')",
                            }}
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-bold truncate text-[15px]">David Chen</span>
                            <span className="text-text-light text-[15px] truncate">
                                @dchen_ux
                            </span>
                        </div>
                        <button className="bg-[#0f1419] text-white px-4 py-1.5 rounded-full text-[14px] font-bold">
                            Follow
                        </button>
                    </div>
                    <button className="text-primary text-[15px] p-4 text-left hover:bg-black/[0.03] transition-colors">
                        Show more
                    </button>
                </div>
            </section>
            <footer className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2 text-[13px] text-text-light">
                <a className="hover:underline" href="#">
                    Terms of Service
                </a>
                <a className="hover:underline" href="#">
                    Privacy Policy
                </a>
                <a className="hover:underline" href="#">
                    Cookie Policy
                </a>
                <a className="hover:underline" href="#">
                    Accessibility
                </a>
                <a className="hover:underline" href="#">
                    Ads info
                </a>
                <span>© 2024 Social Corp.</span>
            </footer>
        </aside>
    );
}
