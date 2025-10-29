import axios from "axios"


const dataToEncode = {
    "templateId": "tech-saas",
    "templateData": {
        "elements": [
            {
                "id": "header",
                "type": "container",
                "position": {
                    "x": 0,
                    "y": 0
                },
                "size": {
                    "width": "100%",
                    "height": 65
                },
                "zIndex": 100,
                "content": {},
                "styles": {
                    "backgroundColor": "#0f172a"
                }
            },
            {
                "id": "logo-saas",
                "type": "heading",
                "position": {
                    "x": 60,
                    "y": 20
                },
                "size": {
                    "width": 140,
                    "height": "auto"
                },
                "zIndex": 101,
                "content": {
                    "text": "TechFlow",
                    "tag": "h3"
                },
                "styles": {
                    "color": "#60a5fa",
                    "fontSize": "1.4rem",
                    "fontWeight": "700"
                }
            },
            {
                "id": "nav-saas",
                "type": "text",
                "position": {
                    "x": 680,
                    "y": 26
                },
                "size": {
                    "width": 420,
                    "height": "auto"
                },
                "zIndex": 101,
                "content": {
                    "text": "Produit    Solutions    Tarifs    Contact"
                },
                "styles": {
                    "color": "#cbd5e0",
                    "fontSize": "0.9rem",
                    "fontWeight": "500"
                }
            },
            {
                "id": "nav-btn",
                "type": "button",
                "position": {
                    "x": 1220,
                    "y": 18
                },
                "size": {
                    "width": 130,
                    "height": 32
                },
                "zIndex": 101,
                "content": {
                    "text": "Essai gratuit",
                    "link": "/signup",
                    "action": "navigate"
                },
                "styles": {
                    "backgroundColor": "#3b82f6",
                    "color": "#ffffff",
                    "fontSize": "0.85rem",
                    "fontWeight": "600",
                    "borderRadius": "6px"
                }
            },
            {
                "id": "hero-bg",
                "type": "container",
                "position": {
                    "x": 0,
                    "y": 65
                },
                "size": {
                    "width": "100%",
                    "height": 650
                },
                "zIndex": 1,
                "content": {},
                "styles": {
                    "background": "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)"
                }
            },
            {
                "id": "hero-badge",
                "type": "text",
                "position": {
                    "x": 580,
                    "y": 170
                },
                "size": {
                    "width": 280,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "🎉 Nouveau : Version 2.0"
                },
                "styles": {
                    "color": "#60a5fa",
                    "fontSize": "0.85rem",
                    "fontWeight": "600",
                    "textAlign": "center",
                    "backgroundColor": "rgba(59, 130, 246, 0.15)",
                    "padding": "0.5rem 1rem",
                    "borderRadius": "20px"
                }
            },
            {
                "id": "hero-h1",
                "type": "heading",
                "position": {
                    "x": 320,
                    "y": 240
                },
                "size": {
                    "width": 800,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "Automatisez votre workflow",
                    "tag": "h1"
                },
                "styles": {
                    "color": "#ffffff",
                    "fontSize": "3.5rem",
                    "fontWeight": "800",
                    "textAlign": "center",
                    "lineHeight": "1.2"
                }
            },
            {
                "id": "hero-desc",
                "type": "text",
                "position": {
                    "x": 420,
                    "y": 380
                },
                "size": {
                    "width": 600,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "La plateforme tout-en-un pour gérer vos projets et booster votre productivité"
                },
                "styles": {
                    "color": "#cbd5e0",
                    "fontSize": "1.2rem",
                    "textAlign": "center",
                    "lineHeight": "1.6"
                }
            },
            {
                "id": "hero-cta-1",
                "type": "button",
                "position": {
                    "x": 540,
                    "y": 490
                },
                "size": {
                    "width": 170,
                    "height": 52
                },
                "zIndex": 2,
                "content": {
                    "text": "Commencer",
                    "link": "/signup",
                    "action": "navigate"
                },
                "styles": {
                    "backgroundColor": "#3b82f6",
                    "color": "#ffffff",
                    "fontSize": "1rem",
                    "fontWeight": "700",
                    "borderRadius": "8px"
                }
            },
            {
                "id": "hero-cta-2",
                "type": "button",
                "position": {
                    "x": 730,
                    "y": 490
                },
                "size": {
                    "width": 170,
                    "height": 52
                },
                "zIndex": 2,
                "content": {
                    "text": "Voir la démo",
                    "link": "#demo",
                    "action": "scroll"
                },
                "styles": {
                    "backgroundColor": "transparent",
                    "color": "#ffffff",
                    "fontSize": "1rem",
                    "fontWeight": "600",
                    "borderRadius": "8px",
                    "border": "2px solid rgba(255,255,255,0.3)"
                }
            },
            {
                "id": "stats-bg",
                "type": "container",
                "position": {
                    "x": 0,
                    "y": 715
                },
                "size": {
                    "width": "100%",
                    "height": 180
                },
                "zIndex": 1,
                "content": {},
                "styles": {
                    "backgroundColor": "#1e293b"
                }
            },
            {
                "id": "stat-1-num",
                "type": "heading",
                "position": {
                    "x": 280,
                    "y": 765
                },
                "size": {
                    "width": 180,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "10K+",
                    "tag": "h2"
                },
                "styles": {
                    "color": "#60a5fa",
                    "fontSize": "2.8rem",
                    "fontWeight": "800",
                    "textAlign": "center"
                }
            },
            {
                "id": "stat-1-txt",
                "type": "text",
                "position": {
                    "x": 280,
                    "y": 825
                },
                "size": {
                    "width": 180,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "Utilisateurs"
                },
                "styles": {
                    "color": "#cbd5e0",
                    "fontSize": "0.9rem",
                    "textAlign": "center"
                }
            },
            {
                "id": "stat-2-num",
                "type": "heading",
                "position": {
                    "x": 630,
                    "y": 765
                },
                "size": {
                    "width": 180,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "99.9%",
                    "tag": "h2"
                },
                "styles": {
                    "color": "#60a5fa",
                    "fontSize": "2.8rem",
                    "fontWeight": "800",
                    "textAlign": "center"
                }
            },
            {
                "id": "stat-2-txt",
                "type": "text",
                "position": {
                    "x": 630,
                    "y": 825
                },
                "size": {
                    "width": 180,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "Uptime"
                },
                "styles": {
                    "color": "#cbd5e0",
                    "fontSize": "0.9rem",
                    "textAlign": "center"
                }
            },
            {
                "id": "stat-3-num",
                "type": "heading",
                "position": {
                    "x": 980,
                    "y": 765
                },
                "size": {
                    "width": 180,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "24/7",
                    "tag": "h2"
                },
                "styles": {
                    "color": "#60a5fa",
                    "fontSize": "2.8rem",
                    "fontWeight": "800",
                    "textAlign": "center"
                }
            },
            {
                "id": "stat-3-txt",
                "type": "text",
                "position": {
                    "x": 980,
                    "y": 825
                },
                "size": {
                    "width": 180,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "Support"
                },
                "styles": {
                    "color": "#cbd5e0",
                    "fontSize": "0.9rem",
                    "textAlign": "center"
                }
            },
            {
                "id": "feat-title",
                "type": "heading",
                "position": {
                    "x": 470,
                    "y": 970
                },
                "size": {
                    "width": 500,
                    "height": "auto"
                },
                "zIndex": 1,
                "content": {
                    "text": "Fonctionnalités",
                    "tag": "h2"
                },
                "styles": {
                    "color": "#1e293b",
                    "fontSize": "2.4rem",
                    "fontWeight": "700",
                    "textAlign": "center"
                }
            },
            {
                "id": "feat-desc",
                "type": "text",
                "position": {
                    "x": 420,
                    "y": 1050
                },
                "size": {
                    "width": 600,
                    "height": "auto"
                },
                "zIndex": 1,
                "content": {
                    "text": "Tout ce dont vous avez besoin pour réussir"
                },
                "styles": {
                    "color": "#64748b",
                    "fontSize": "1.1rem",
                    "textAlign": "center"
                }
            },
            {
                "id": "card-1",
                "type": "container",
                "position": {
                    "x": 100,
                    "y": 1150
                },
                "size": {
                    "width": 360,
                    "height": 250
                },
                "zIndex": 1,
                "content": {},
                "styles": {
                    "backgroundColor": "#f8fafc",
                    "borderRadius": "12px",
                    "border": "1px solid #e2e8f0"
                }
            },
            {
                "id": "card-1-icon",
                "type": "text",
                "position": {
                    "x": 130,
                    "y": 1180
                },
                "size": {
                    "width": 60,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "⚡"
                },
                "styles": {
                    "fontSize": "2.5rem"
                }
            },
            {
                "id": "card-1-title",
                "type": "heading",
                "position": {
                    "x": 130,
                    "y": 1250
                },
                "size": {
                    "width": 300,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "Ultra rapide",
                    "tag": "h3"
                },
                "styles": {
                    "color": "#1e293b",
                    "fontSize": "1.4rem",
                    "fontWeight": "700"
                }
            },
            {
                "id": "card-1-desc",
                "type": "text",
                "position": {
                    "x": 130,
                    "y": 1295
                },
                "size": {
                    "width": 300,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "Performance optimale"
                },
                "styles": {
                    "color": "#64748b",
                    "fontSize": "0.9rem"
                }
            },
            {
                "id": "card-2",
                "type": "container",
                "position": {
                    "x": 540,
                    "y": 1150
                },
                "size": {
                    "width": 360,
                    "height": 250
                },
                "zIndex": 1,
                "content": {},
                "styles": {
                    "backgroundColor": "#f8fafc",
                    "borderRadius": "12px",
                    "border": "1px solid #e2e8f0"
                }
            },
            {
                "id": "card-2-icon",
                "type": "text",
                "position": {
                    "x": 570,
                    "y": 1180
                },
                "size": {
                    "width": 60,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "🔒"
                },
                "styles": {
                    "fontSize": "2.5rem"
                }
            },
            {
                "id": "card-2-title",
                "type": "heading",
                "position": {
                    "x": 570,
                    "y": 1250
                },
                "size": {
                    "width": 300,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "Sécurisé",
                    "tag": "h3"
                },
                "styles": {
                    "color": "#1e293b",
                    "fontSize": "1.4rem",
                    "fontWeight": "700"
                }
            },
            {
                "id": "card-2-desc",
                "type": "text",
                "position": {
                    "x": 570,
                    "y": 1295
                },
                "size": {
                    "width": 300,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "Chiffrement bancaire"
                },
                "styles": {
                    "color": "#64748b",
                    "fontSize": "0.9rem"
                }
            },
            {
                "id": "card-3",
                "type": "container",
                "position": {
                    "x": 980,
                    "y": 1150
                },
                "size": {
                    "width": 360,
                    "height": 250
                },
                "zIndex": 1,
                "content": {},
                "styles": {
                    "backgroundColor": "#f8fafc",
                    "borderRadius": "12px",
                    "border": "1px solid #e2e8f0"
                }
            },
            {
                "id": "card-3-icon",
                "type": "text",
                "position": {
                    "x": 1010,
                    "y": 1180
                },
                "size": {
                    "width": 60,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "🎨"
                },
                "styles": {
                    "fontSize": "2.5rem"
                }
            },
            {
                "id": "card-3-title",
                "type": "heading",
                "position": {
                    "x": 1010,
                    "y": 1250
                },
                "size": {
                    "width": 300,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "Personnalisable",
                    "tag": "h3"
                },
                "styles": {
                    "color": "#1e293b",
                    "fontSize": "1.4rem",
                    "fontWeight": "700"
                }
            },
            {
                "id": "card-3-desc",
                "type": "text",
                "position": {
                    "x": 1010,
                    "y": 1295
                },
                "size": {
                    "width": 300,
                    "height": "auto"
                },
                "zIndex": 2,
                "content": {
                    "text": "Interface adaptable"
                },
                "styles": {
                    "color": "#64748b",
                    "fontSize": "0.9rem"
                }
            }
        ],
        "settings": {
            "backgroundColor": "#ffffff",
            "maxWidth": "1440px"
        }
    },
    "storeContext": {
        "storeName": "The Magic Shop Galaxy - TMSG",
        "storeType": "electronics",
        "description": "bah je vend rien de mal hein je ne sais pas pourquoi cette question de \"Description de votre boutique\" je vend des articles techno de bonne qualité ",
        "location": "Abidjan",
        "phone": "2250576778556",
        "currency": "XOF",
        "language": "fr"
    }
}

try {
    const res = await axios.post("http://localhost:6532/api/security/test", dataToEncode)
    console.log("api res: ", res)
} catch (error) {
    console.error("Error while testing: ", error.response.data)
}