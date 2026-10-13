# Portafolio estático servido con nginx
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html style.css main.js viz-portrait.js viz-portrait.js viz-core.js viz-a.js viz-b.js viz-c.js viz-d.js /usr/share/nginx/html/
COPY pdfs/ /usr/share/nginx/html/pdfs/

EXPOSE 80
