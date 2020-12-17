import scrapy
from scrapy.spiders import CrawlSpider, Rule
from scrapy.linkextractors import LinkExtractor

class MySpider(CrawlSpider):
    name = 'example'
    allowed_domains = ['enterprisedb.com']
    start_urls = ['http://www.enterprisedb.com/edb-docs']

    print(scrapy.linkextractors.IGNORED_EXTENSIONS)
    rules = (
      Rule(LinkExtractor(deny_extensions=scrapy.linkextractors.IGNORED_EXTENSIONS + ['epub']), callback='dump', follow=True),
    )

    def dump(self, response):
      nav_links = response.css('.doc-nav a::text').getall()
      sub_nav = response.css('div.related')
      if len(sub_nav) > 0:
        sub_nav = sub_nav[0].css('li.nav-item a::text').getall()

      nav = response.css('.doc-nav *::text').getall()
      cleaned_nav = [];
      for text in nav:
        if 'Other versions of this page' in text:
          break
        cleaned_text = text.replace('→','').strip()
        if len(cleaned_text) > 0:
          cleaned_nav.append(cleaned_text)

      yield {
        'product': nav_links[0] if len(nav_links) > 0 else None,
        'version': nav_links[1] if len(nav_links) > 1 else None,
        'nav': cleaned_nav,
        'sub_nav': list(map(str.strip, sub_nav)),
        'title': response.css('title::text').get(),
        'url': response.url,
      }
