export function StoryRail() {
    const stories = [
        {
            id: "1",
            name: "Your Story",
            image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCVh8p3iIVB6V8SmlrlYhTYWcYKtbi1qAwIQl3p699QnBtz2ery9QBZekmokbzjOXzYF5frjM8R7ARMtmQB6nxSZi64f7NerLQ7qGEcIt2yl8HmIOmElLD9vvPsDgz-rHHV64QlGEJ_EV4xpBfyYCx1qBycp3FL959LShnq007ra5467_vkjYyUqisNvZKv3m86lX1dZoj63dTuvEzUFto3QRrPkMAK8WMEZAxi0JbbFowvF9pBwhC7djdOs5EkUd44L02u8cE66tM0",
            isUser: true,
        },
        {
            id: "2",
            name: "Jordan",
            image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDd-evzsvivS30hlWWhs8NK4GS34z0MFLA5ys1E3Xi1Ze3ANPr33B0eo21EVy-ojF_5DOaAZE0B3oFNEkrr_Mg7yUw5MjBFBPl9K0FqUaqfg7kRqt7THyQOFiT-26kEOsmd3DLbSysRcKBwH-ceObCR6X9heUYmSw5DotEK-maSeeV0OdOCRtH8RLjgLjOwwYcT5GKk3JH4tOlCxbirUsuCk5Kikl9XBPwJXR8-J_VDkcTSowSNq6G-XXTq53J7jarGjNf4ml9v8hFW",
        },
        {
            id: "3",
            name: "Taylor",
            image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCrp34VmESHTo261MN1Rc3zBWkEtk09VIjrBp8j8OVmuRKK6ceIlRLRVCMVyjwYBU4a87Tz6vikc-Mk2NAh1dx5pzPCgbrva_agHBP3bm7gfy0eJ8ZvwnUFIvuslrOZbbibFsif7CPsuyV5q2IhY26-0HHFkS8qQ1CN3rHz_yThZB0NXZKeT5T0w9tjWuc1akfU15v2RkpkvCKrVbWfjyduXU8Onn7VjgT-gK2mjXoh9-hLe3YL10NQSRntESIK-qU6pd6OI599Py9n",
        },
        {
            id: "4",
            name: "Morgan",
            image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCXdk5dh86NTCbKe4uLLFK5NqhYzhGpxA4AKvVrCW_HKiw-9qxPrPfb9laqZrDl8Lo2e97tBII8c03MKmx2qk0kVMiqVnvpdSPZda5BIs5KPxs0uwVkNA8ciklAYsXYTHEmVVzTOmFeESPrOyBKl4tq8Wt0JAVkLoLq6-nwtSYAMOqgIpMtKivBasXLe2DdhG4CuUANRO0XlW-a6E9NLpobOgevAw5yu-vRVem1WIBOU-XMHrf2j_liJ5z8--zw8cWW0OzCdxfUuwlF",
        },
        {
            id: "5",
            name: "Casey",
            image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDjrb9wqc1laq0I-KSdwIdLuZ045BVBt98QhfwvwDj3xQO6sKwW8TzVO4C9Z6x3z40STRTl8tDEd2XYe6cSB9GouxR2DRBgFgLYmnyDibRuDD5ZU1OnQrnimCAbxOzJa2xnZfzn4gS-rTnt1dhsIOoKuLkg4dkzD-rO2sLSEqTRQci7XE2hY91o3lRik7cWOlP1TumhyIcd4g5SNYUMHEJDei8i1goxejXojYpJyc7yB7o9w8xtR54oIzZkGdLmJS5bwvdx7sAEieDk",
        },
    ];

    return (
        <div className="flex gap-4 p-4 border-b border-border-gray overflow-x-auto no-scrollbar">
            {stories.map((story) => (
                <div key={story.id} className="flex flex-col items-center gap-1 min-w-[60px] cursor-pointer">
                    <div className={`p-[3px] rounded-full ${!story.isUser ? "bg-gradient-to-tr from-yellow-400 to-primary" : "bg-gray-200"}`}>
                        <div className="w-14 h-14 rounded-full bg-cover bg-center border-2 border-white relative" style={{ backgroundImage: `url('${story.image}')` }}>
                            {story.isUser && (
                                <div className="absolute bottom-0 right-0 w-5 h-5 bg-primary rounded-full border-2 border-white flex items-center justify-center text-white">
                                    <span className="material-symbols-outlined !text-[14px]">add</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <span className="text-xs truncate w-full text-center font-medium">{story.name}</span>
                </div>
            ))}
        </div>
    );
}
