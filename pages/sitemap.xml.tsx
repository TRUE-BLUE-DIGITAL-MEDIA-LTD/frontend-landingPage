function generateSiteMap({ host }) {
  console.log(host);
  return `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <!--We manually set the two URLs we know already-->
    <url>
      <loc>https://${host}/</loc>
    </url>
  </urlset>
`;
}
function SiteMap() {
  // getServerSideProps will do the heavy lifting
}
export default SiteMap;

export async function getServerSideProps({ res, req }) {
  const host = req.headers.host;

  // We generate the XML sitemap with the posts data
  const sitemap = generateSiteMap({ host });

  res.setHeader("Content-Type", "text/xml");
  // we send the XML to the browser
  res.write(sitemap);
  res.end();
  return {
    props: {},
  };
}
