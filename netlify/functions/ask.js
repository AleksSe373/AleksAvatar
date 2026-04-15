export const handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 204,
            headers: corsHeaders(),
            body: ""
        };
    }

    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            headers: corsHeaders(),
            body: JSON.stringify({ error: "Method Not Allowed" })
        };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            headers: corsHeaders(),
            body: JSON.stringify({ error: "Serverio konfigūracija nebaigta: trūksta OPENAI_API_KEY." })
        };
    }

    let payload;
    try {
        payload = JSON.parse(event.body || "{}");
    } catch (_) {
        return {
            statusCode: 400,
            headers: corsHeaders(),
            body: JSON.stringify({ error: "Neteisingas JSON formatas." })
        };
    }

    const question = String(payload.question || "").trim();
    const context = String(payload.context || "").trim();
    const questionWords = question.split(/\s+/).filter(Boolean);
    if (questionWords.length < 2) {
        return {
            statusCode: 400,
            headers: corsHeaders(),
            body: JSON.stringify({ error: "Klausimui pakanka 2 žodžių. Įrašyk bent du žodžius." })
        };
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                temperature: 0.2,
                messages: [
                    {
                        role: "system",
                        content: "Atsakyk lietuviškai, glaustai ir aiškiai. Vadovaukis visu pateiktu projekto kontekstu nuo A iki Z (visų žingsnių aprašymai, naudoti įrankiai ir mokymosi patirtis). Jei klausimas trumpas, su sutrumpinimais ar tik iš 2 žodžių, vis tiek atsakyk pagal kontekstą."
                    },
                    {
                        role: "user",
                        content: `Papildomas projekto tekstas (kontekstas):\n${context.slice(0, 2000)}`
                    },
                    {
                        role: "user",
                        content: question
                    }
                ]
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const msg = err?.error?.message || "OpenAI API klaida.";
            return {
                statusCode: 502,
                headers: corsHeaders(),
                body: JSON.stringify({ error: msg })
            };
        }

        const data = await response.json();
        const answer = data?.choices?.[0]?.message?.content?.trim() || "Atsakymas negautas.";

        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: JSON.stringify({ answer })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: corsHeaders(),
            body: JSON.stringify({ error: `Serverio klaida: ${error.message}` })
        };
    }
};

function corsHeaders() {
    return {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
    };
}
