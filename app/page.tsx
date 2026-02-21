"use client";

import { useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Search, Plus, Edit2, Trash2, Upload } from "lucide-react";

// Custom image component to handle empty src
const ImageComponent = (props: any) => {
  const { src, alt } = props;
  // Only render if src is not empty
  if (!src || src.trim() === "") {
    return null;
  }
  return <img {...props} alt={alt || "Blog image"} />;
};

interface Post {
  slug: string;
  title: string;
  tag: string;
  date: string;
  content?: string;
}

const ADMIN_EMAIL = "parrykaju@gmail.com";
const validAdmin = (e: string) => e?.trim().toLowerCase() === ADMIN_EMAIL;
const readingTime = (txt: string) => Math.max(1, Math.ceil(txt.split(/\s+/).length / 200));

export default function Page() {
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [active, setActive] = useState<Post | null>(null);
  const [content, setContent] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newTag, setNewTag] = useState("Development");
  const [newMarkdown, setNewMarkdown] = useState("# New Blog\n\nWrite here...");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const isAdminSaved = localStorage.getItem("ntl_admin") === "true";
    if (isAdminSaved) setIsAdmin(true);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === "l") setLoginOpen(v => !v);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    const loadBlogs = async () => {
      try {
        const response = await fetch("/blogs/index.json");
        const serverBlogs = await response.json();
        const localBlogs = JSON.parse(localStorage.getItem("ntl_local_posts") || "[]") as Post[];
        
        const blogsWithContent = await Promise.all(
          serverBlogs.map(async (blog: Post) => {
            try {
              const text = await fetch(`/blogs/${blog.slug}.md`).then(r => r.text());
              return { ...blog, content: text };
            } catch {
              return blog;
            }
          })
        );
        
        setPosts([...localBlogs, ...blogsWithContent]);
      } catch {
        const local = JSON.parse(localStorage.getItem("ntl_local_posts") || "[]") as Post[];
        setPosts(local);
      }
    };
    loadBlogs();
  }, []);

  useEffect(() => {
    if (!active) return;
    setContent(active.content || "");
  }, [active]);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const sc = (h.scrollTop) / (h.scrollHeight - h.clientHeight);
      setProgress(sc * 100);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filtered = posts.filter((p: Post) => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchesTag = !selectedTag || p.tag === selectedTag;
    return matchesSearch && matchesTag;
  });

  const allTags = Array.from(new Set(posts.map(p => p.tag))).sort();
  const featured = filtered.length > 0 ? filtered[0] : null;
  const readTime = useMemo(() => readingTime(content || ""), [content]);

  function saveBlog() {
    if (!newTitle.trim()) return alert("Add title");
    if (!newTag.trim()) return alert("Add tag");
    
    const slug = editingSlug || "local-" + Date.now();
    const post: Post = {
      slug,
      title: newTitle,
      tag: newTag,
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short" }),
      content: newMarkdown
    };

    const existing = JSON.parse(localStorage.getItem("ntl_local_posts") || "[]") as Post[];
    
    if (editingSlug) {
      const updated = existing.map(p => p.slug === editingSlug ? post : p);
      localStorage.setItem("ntl_local_posts", JSON.stringify(updated));
      setPosts(c => c.map(p => p.slug === editingSlug ? post : p));
    } else {
      localStorage.setItem("ntl_local_posts", JSON.stringify([post, ...existing]));
      setPosts(p => [post, ...p]);
    }

    setEditorOpen(false);
    setEditingSlug(null);
    setNewTitle("");
    setNewTag("Development");
    setNewMarkdown("# New Blog\n\nWrite here...");
  }

  function deleteBlog(slug: string) {
    if (!confirm("Delete this blog post permanently?")) return;
    const existing = JSON.parse(localStorage.getItem("ntl_local_posts") || "[]") as Post[];
    const updated = existing.filter(p => p.slug !== slug);
    localStorage.setItem("ntl_local_posts", JSON.stringify(updated));
    setPosts(p => p.filter(b => b.slug !== slug));
    setActive(null);
  }

  function editBlog(post: Post) {
    setEditingSlug(post.slug);
    setNewTitle(post.title);
    setNewTag(post.tag);
    setNewMarkdown(post.content || "");
    setEditorOpen(true);
    setActive(null);
  }

  function handleImageUpload(file: File, callback: (url: string) => void) {
    const reader = new FileReader();
    reader.onload = () => {
      callback(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function onDropImage(e: React.DragEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) {
      handleImageUpload(f, (url) => {
        setNewMarkdown(m => m + `\n\n![image](${url})\n`);
      });
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleImageUpload(file, (url) => {
            const textarea = e.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = newMarkdown;
            const newText = text.substring(0, start) + `![image](${url})` + text.substring(end);
            setNewMarkdown(newText);
          });
        }
        break;
      }
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageUpload(file, (url) => {
        setNewMarkdown(m => m + `\n\n![image](${url})\n`);
      });
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {active && <div className="fixed top-0 left-0 h-1 bg-green-400 z-50" style={{ width: progress + "%" }} />}

      <nav className="border-b border-zinc-800 sticky top-0 bg-black/95 backdrop-blur z-40">
        <div className="max-w-6xl mx-auto px-8 md:px-20 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-green-400">NEXT TOKEN LAB</h1>
          <div className="flex gap-4 items-center">
            {isAdmin && !active && (
              <>
                <button 
                  onClick={() => {
                    setEditingSlug(null);
                    setNewTitle("");
                    setNewTag("Development");
                    setNewMarkdown("# New Blog\n\nWrite here...");
                    setEditorOpen(true);
                  }} 
                  className="btn-primary flex items-center gap-1 text-sm"
                >
                  <Plus size={16} />New Blog
                </button>
                <button 
                  onClick={() => { 
                    setIsAdmin(false); 
                    localStorage.removeItem("ntl_admin");
                    setEmail("");
                  }} 
                  className="btn-primary text-sm"
                >
                  Logout
                </button>
              </>
            )}
            {isAdmin && active && (
              <button 
                onClick={() => { 
                  setIsAdmin(false); 
                  localStorage.removeItem("ntl_admin");
                  setEmail("");
                }} 
                className="btn-primary text-sm"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="px-8 md:px-20 py-10 space-y-20 max-w-6xl mx-auto">

        {!active ? (
          <>
            <section className="grid md:grid-cols-2 gap-14 items-center py-14 fade-in">
              <div className="space-y-6">
                <div>
                  <h2 className="text-5xl md:text-6xl font-bold">
                    Next Token <span className="text-green-400">Lab</span>
                  </h2>
                  <p className="text-green-400 text-sm mt-3">Understanding. Building. Shipping.</p>
                </div>
                <div className="space-y-4 border-l-2 border-green-400/30 pl-6">
                  <div>
                    <div className="text-xs text-green-400 uppercase tracking-widest font-semibold">By MD Parwez</div>
                    <div className="text-sm text-green-300 font-medium mt-1">AI/ML System Engineer • Right Token Engineer </div>
                    <p className="text-base text-gray-200 mt-4 leading-relaxed">
                    AI/ML Engineer with 4 years of intensive coursework and research in Artificial Intelligence and Machine Learning, along with 2+ years of hands-on experience building real-world AI solutions. Skilled in Machine Learning, Generative AI, Agentic AI, Data Science, advanced ML models, LLM architectures, and designing scalable, production-ready intelligent workflows.
                    </p>
                  </div>
                </div>
              </div>
                <div className="card-gradient bg-zinc-900/50 font-mono text-green-400 text-sm space-y-2 p-8 rounded-2xl">
                <div className="text-green-300">$ <span className="text-green-400">predict</span>(next_token)</div>
                <div className="text-green-600 text-xs mt-4">{`// Quality > Quantity`}</div>
                <div className="text-green-600 text-xs">{`// Understanding > Hype`}</div>
                <div className="text-green-600 text-xs">{`// Systems > Buzzwords`}</div>
              </div>
            </section>

            {featured && (
              <section className="card-gradient p-6 md:p-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <div className="text-xs text-green-400 font-semibold uppercase">Latest Insight</div>
                </div>
                <h3 
                  className="text-2xl md:text-3xl font-bold cursor-pointer link-fancy" 
                  onClick={() => setActive(featured)}
                >
                  {featured.title}
                </h3>
                <p className="text-sm text-gray-400 mt-3">{featured.date} • {featured.tag}</p>
              </section>
            )}

            <section className="space-y-3 fade-in">
              <label className="text-sm text-gray-400 uppercase tracking-wide">Search Posts</label>
              <div className="search-input flex items-center gap-3 rounded-xl px-4 py-3 bg-zinc-900/30">
                <Search size={18} className="text-green-400" />
                <input 
                  placeholder="Search by title..." 
                  value={search} 
                  onChange={(e) => setSearch(e.currentTarget.value)} 
                  className="bg-transparent outline-none w-full text-white placeholder:text-gray-600"
                />
              </div>
            </section>

            {allTags.length > 0 && (
              <section className="space-y-3 fade-in">
                <label className="text-sm text-gray-400 uppercase tracking-wide">Filter by Topic</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={`tag-badge ${
                      !selectedTag
                        ? "bg-green-400 text-black font-semibold border-green-400 active"
                        : ""
                    }`}
                  >
                    All Topics
                  </button>
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                      className={`tag-badge ${
                        selectedTag === tag
                          ? "bg-green-400 text-black font-semibold border-green-400 active"
                          : ""
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-4 fade-in">
              <h2 className="text-2xl font-bold text-gray-200">Insights Library ({filtered.length})</h2>
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>No posts found. Try a different search or filter.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-6">
                  {filtered.map((p: Post, idx) => {
                    const rt = p.content ? readingTime(p.content) : 3;
                    return (
                      <div 
                        key={p.slug} 
                        onClick={() => setActive(p)}
                        className="blog-card card-gradient cursor-pointer"
                        style={{ animationDelay: `${idx * 0.1}s` }}
                      >
                        <div className="p-6 space-y-4">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <span className="tag-badge">{p.tag}</span>
                              <h3 className="text-lg font-bold mt-3 text-gray-100 line-clamp-2 blog-card-header">{p.title}</h3>
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    editBlog(p);
                                  }}
                                  className="p-1 text-blue-400 hover:text-blue-300 transition"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteBlog(p.slug);
                                  }}
                                  className="p-1 text-red-400 hover:text-red-300 transition"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex justify-between items-center text-xs text-gray-500 pt-4 border-t border-zinc-800">
                            <span>{p.date}</span>
                            <span>{rt} min read</span>
                          </div>
                          <div className="text-green-400 text-sm mt-3 font-semibold">read →</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* WHY THIS LAB */}
            <section className="card-gradient border-l-4 border-green-400 p-8 md:p-10 space-y-4 fade-in">
              <div className="space-y-4">
                <h3 className="text-2xl md:text-3xl font-bold text-white">Why I Started This Lab</h3>
                <div className="space-y-3">
                  <p className="text-gray-300 text-base leading-relaxed">
                    <span className="text-green-400 font-semibold">The Problem:</span> Most engineers copy-paste code, blindly use frameworks, and deploy models — without truly understanding <span className="text-green-300 font-semibold italic">how they actually work</span> at a fundamental level.
                  </p>
                  <p className="text-gray-300 text-base leading-relaxed">
                    They don't ask the hard questions: What algorithm powers this? Why does this technique work? How does the system <span className="text-green-300 font-semibold italic">actually behave</span> in production? What are the real tradeoffs? What happens when things break?
                  </p>
                  <p className="text-gray-300 text-base leading-relaxed">
                    <span className="text-green-400 font-semibold">My Approach:</span> I obsess over research papers, deep architectural thinking, and real-world implementation challenges. This lab is where I share those hard-won insights — the <span className="text-green-300 font-semibold italic">why</span> behind the <span className="text-green-300 font-semibold italic">how</span>.
                  </p>
                  <p className="text-gray-300 text-base leading-relaxed font-semibold text-green-300 mt-4">
                    Real AI engineering. Real understanding. Real systems that actually work.
                  </p>
                </div>
              </div>
            </section>

            <section className="card-gradient p-8 md:p-12 space-y-10 fade-in">
              <div>
                <h2 className="text-4xl font-bold mb-8 text-white">About the Lab</h2>
                <p className="text-gray-200 text-lg leading-relaxed mb-4">
                  I'm <span className="text-green-400 font-bold">MD Parwez</span>, an AI/ML systems engineer with 6+ years of experience (4 years of academic research and coursework + 2+ years building real-world AI solutions). I don’t just use AI — I design, research, build, and continuously explore intelligent systems and next-generation AI workflows.
                </p>
                <p className="text-gray-300 text-lg leading-relaxed">
                  My focus is on the <span className="text-green-400 font-semibold">hard part of AI</span>: Understanding <span className="text-green-400 font-semibold">how models actually think</span>, designing <span className="text-green-400 font-semibold">robust architectures</span>, and building <span className="text-green-400 font-semibold">systems that scale</span>. From token mechanics to full pipeline engineering. From attention mechanisms to production inference optimization.
                </p>
                <p className="text-gray-300 text-lg leading-relaxed mt-4">
                  I believe real AI engineering isn't about chasing the latest trend or hyped frameworks — it's about <span className="text-green-300 font-semibold">deep understanding</span>, <span className="text-green-300 font-semibold">clear design patterns</span>, and <span className="text-green-300 font-semibold">code that actually works</span>. Not teaching what I've learned. <span className="text-green-400 italic">Building</span> real intelligence.
                </p>
              </div>

              <div className="border-t border-green-400/20 pt-8">
                <h3 className="text-2xl font-bold text-green-400 mb-6">Background</h3>
                <div className="space-y-4 text-gray-300">
                  <p>
                    <span className="text-green-300 font-semibold">4 years in Data Science Research</span> — exploring novel approaches, publishing findings, understanding the theoretical foundations of machine learning at a deep level.
                  </p>
                  <p>
                    <span className="text-green-300 font-semibold">2 years shipping production AI</span> — taking research insights and turning them into real systems that handle billions of tokens, millions of requests, and massive scale with reliability.
                  </p>
                  <p>
                    Specialized in LLM architectures, token-first thinking, production inference, system design, and making AI work in the real world where latency, cost, and reliability matter.
                  </p>
                </div>
              </div>

              <div className="border-t border-green-400/20 pt-8">
                <h3 className="text-2xl font-bold text-green-400 mb-6">Why Read This Lab</h3>
                <p className="text-gray-300 mb-6 text-base">Built for engineers and builders serious about understanding AI — not just using it or chasing trends.</p>
                <div className="space-y-4 text-gray-300">
                  <div className="flex gap-4 items-start">
                    <span className="text-green-400 text-lg font-bold mt-0.5">→</span>
                    <div>
                      <span className="text-green-300 font-semibold">Complex research, engineering clarity:</span>
                      <p className="text-sm mt-1">Advanced AI concepts explained with production-grade thinking, not just theory.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <span className="text-green-400 text-lg font-bold mt-0.5">→</span>
                    <div>
                      <span className="text-green-300 font-semibold">Real architecture patterns:</span>
                      <p className="text-sm mt-1">LLM design, agent systems, token optimization, and proven production patterns.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <span className="text-green-400 text-lg font-bold mt-0.5">→</span>
                    <div>
                      <span className="text-green-300 font-semibold">Token-first perspective:</span>
                      <p className="text-sm mt-1">Understanding how AI works at the core - from embeddings to generation to optimization.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 items-start">
                    <span className="text-green-400 text-lg font-bold mt-0.5">→</span>
                    <div>
                      <span className="text-green-300 font-semibold">Systems that ship:</span>
                      <p className="text-sm mt-1">Not just theory or prototypes — ideas and patterns you can actually build and deploy.</p>
                    </div>
                  </div>
                </div>
                <p className="text-gray-400 italic mt-8 text-base border-l-2 border-green-400/30 pl-4">The goal isn't to use AI. It's to truly understand how it works — and then engineer systems that actually matter.</p>
              </div>

              <div className="border-t border-green-400/20 pt-8">
                <p className="text-green-400 font-mono text-sm tracking-wide">$ <span className="text-green-300">engineer_mindset</span> = think → design → build → deploy → improve</p>
              </div>
            </section>
          </>
        ) : (
          <article className="max-w-4xl mx-auto py-10 fade-in">
            <button 
              onClick={() => setActive(null)} 
              className="link-fancy mb-6 flex items-center gap-2 text-sm font-semibold"
            >
              ← Back to Lab
            </button>

            <div className="mb-10 pb-10 border-b border-zinc-800 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs bg-green-400/20 text-green-300 px-2 py-1 rounded border border-green-400/30">{active.tag}</span>
                  <h1 className="text-5xl font-bold mt-4 leading-tight">{active.title}</h1>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => editBlog(active)}
                      className="btn-primary bg-blue-400/20 text-blue-300 border-blue-400/30 hover:bg-blue-400/30 hover:border-blue-400 p-3"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => {
                        deleteBlog(active.slug);
                        setActive(null);
                      }}
                      className="btn-primary bg-red-400/20 text-red-300 border-red-400/30 hover:bg-red-400/30 hover:border-red-400 p-3"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
              <div className="text-gray-400 space-y-2">
                <div className="flex gap-4 text-sm">
                  <span>{active.date}</span>
                  <span>•</span>
                  <span>{readTime} min read</span>
                </div>
              </div>
            </div>

            <div className="prose prose-invert max-w-none 
              prose-headings:text-white prose-headings:font-bold 
              prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-h4:text-xl 
              prose-p:text-gray-200 prose-p:leading-relaxed prose-p:text-lg 
              prose-a:text-green-400 prose-a:no-underline hover:prose-a:underline 
              prose-strong:text-white prose-strong:font-bold 
              prose-em:text-gray-100 prose-em:italic 
              prose-code:bg-zinc-900 prose-code:text-green-300 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:border prose-code:border-zinc-800
              prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
              prose-blockquote:border-l-4 prose-blockquote:border-green-400 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-300
              prose-ul:text-gray-200 prose-ol:text-gray-200 prose-li:marker:text-green-400
              prose-img:rounded-lg prose-img:border prose-img:border-zinc-800">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{ img: ImageComponent }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </article>
        )}

        {!active && (
          <footer className="border-t border-green-400/20 pt-16 pb-12">
            <div className="space-y-6 text-center">
              <div>
                <h3 className="text-2xl font-bold text-green-400">Next Token Lab</h3>
                <p className="text-gray-300 mt-2">Engineering production AI systems. Real thinking. Real code. Real impact.</p>
              </div>
              <div className="border-t border-green-400/20 pt-8">
                <p className="text-sm text-gray-500">© 2026 MD Parwez. Built with intelligence.</p>
              </div>
            </div>
          </footer>
        )}

      </div>

      {editorOpen && isAdmin && (
        <div className="modal-overlay fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50 overflow-y-auto backdrop-blur-sm">
          <div className="modal-content card-gradient border-green-400/30 w-full max-w-5xl p-6 grid md:grid-cols-2 gap-6 my-auto">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-green-400">{editingSlug ? "Edit Blog" : "New Blog"}</h3>
              </div>
              <input 
                placeholder="Blog Title" 
                value={newTitle} 
                onChange={(e) => setNewTitle(e.currentTarget.value)} 
                className="bg-black border border-zinc-700 rounded px-3 py-2 text-white w-full focus:border-green-400 focus:outline-none transition"
              />
              <input 
                placeholder="Tag (e.g., Development, AI, LLM)" 
                value={newTag} 
                onChange={(e) => setNewTag(e.currentTarget.value)} 
                className="bg-black border border-zinc-700 rounded px-3 py-2 text-white w-full focus:border-green-400 focus:outline-none transition"
              />
              <div className="text-xs text-gray-400">Formatting Tips: **bold**, *italic*, `code`, [link](url), ![image](url)</div>
              <textarea
                value={newMarkdown}
                onChange={(e) => setNewMarkdown(e.currentTarget.value)}
                onDrop={onDropImage}
                onDragOver={(e) => e.preventDefault()}
                onPaste={handlePaste}
                placeholder="Write your blog content here... You can paste images directly or drag them in!"
                className="w-full h-96 bg-black border border-zinc-700 rounded px-3 py-2 font-mono text-sm text-white focus:border-green-400 transition resize-none"
              />
              <div className="flex gap-2">
                <label className="flex items-center gap-2 px-3 py-2 btn-primary bg-green-400/10 border-green-400/30 text-green-400">
                  <Upload size={16} />
                  <span className="text-sm">Upload Image</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="text-xs text-gray-500">💡 You can also drag images or paste them directly into the editor</div>
              <div className="flex gap-3">
                <button 
                  onClick={saveBlog} 
                  className="bg-green-400 text-black px-4 py-2 rounded font-semibold hover:bg-green-300 transition transform hover:scale-105"
                >
                  {editingSlug ? "Update" : "Publish"}
                </button>
                <button 
                  onClick={() => {
                    setEditorOpen(false);
                    setEditingSlug(null);
                    setNewTitle("");
                    setNewTag("Development");
                    setNewMarkdown("# New Blog\n\nWrite here...");
                  }} 
                  className="btn-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="card-gradient p-4 rounded-lg overflow-auto max-h-96">
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{ img: ImageComponent }}
                >
                  {newMarkdown}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {loginOpen && !isAdmin && (
        <div className="modal-overlay fixed bottom-6 right-6 bg-zinc-900 border border-zinc-700 p-6 rounded-xl flex flex-col gap-3 z-50 w-80\">
          <h3 className="text-sm font-semibold text-green-400">Admin Access</h3>
          <input 
            placeholder="admin email" 
            value={email} 
            onChange={(e) => { setEmail(e.currentTarget.value); setLoginError(""); }} 
            className="bg-black border border-zinc-700 rounded px-3 py-2 text-white focus:border-green-400 focus:outline-none transition"
          />
          <button 
            onClick={() => { 
              if (validAdmin(email)) { 
                setIsAdmin(true); 
                localStorage.setItem("ntl_admin", "true"); 
                setLoginOpen(false); 
              } else setLoginError("Access denied"); 
            }} 
            className="bg-green-400 text-black px-3 py-2 rounded font-semibold hover:bg-green-300 transition transform hover:scale-105"
          >
            Unlock
          </button>
          {loginError && <div className="text-red-400 text-xs">{loginError}</div>}
        </div>
      )}

    </main>
  );
}
