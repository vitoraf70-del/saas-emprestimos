/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdfkit carrega arquivos de fonte (.afm) do próprio pacote em runtime.
    // Sem isto o bundle do serverless não acha as fontes e o PDF quebra (500).
    serverComponentsExternalPackages: ["pdfkit"],
    serverActions: {
      bodySizeLimit: "2mb"
    }
  }
};

export default nextConfig;
