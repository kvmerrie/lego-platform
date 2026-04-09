import { describe, expect, test } from 'vitest';
import { listAffiliateOffers } from './affiliate-data-access';

describe('affiliate data access', () => {
  test('returns reviewed merchant offers with corrected direct product URLs', () => {
    expect(
      listAffiliateOffers('10316').map((affiliateOffer) => ({
        merchantId: affiliateOffer.merchantId,
        outboundUrl: affiliateOffer.outboundUrl,
      })),
    ).toEqual([
      {
        merchantId: 'amazon-nl',
        outboundUrl:
          'https://www.amazon.nl/LEGO-10316-Icons-LORD-RINGS/dp/B0BVMZ5NT5?crid=1PZX2UTHGPHQN&dib=eyJ2IjoiMSJ9.eV5BU8F5Ha1yyEu_F_vgmAq8ud289j12LwS936M_GLEQb2qBSlTJ0daClsdfbORpLFHahOSsox9ucg_dMXqRnWtEESZGcdk4rOgRf5ElQg5gopSMHRkiJyMDIguuVPHAhEcajIHvW5M27N2CXy9ilRIUJjJlsI9X5KKRAJp4I4Tc-v7Wca3KSZZ5jwHebrXhz_HpCpn4PEKuHLxjdTPluO74yAL9k4OeAnM0N9bUw9wL0BXaFJd1NRekk3_x6u_93FwiicKAu9zFUJG6FIeFBBDk9CenCrLyOMm793LMLfk.djPen0fBRza0RkXHY7s9nSUD5leeYbY5HwfzJg2uxZg&dib_tag=se&keywords=lego+lord+of+the+rings+barad-d%C3%BBr&qid=1775758479&sprefix=The+Lord+of+the+Rings%3A+Barad-d%C3%BBr%2Caps%2C88&sr=8-2&linkCode=ll2&tag=brickhunt09-21&linkId=527398c8997a060eeca3c83403d248bb&ref_=as_li_ss_tl',
      },
      {
        merchantId: 'lego-nl',
        outboundUrl:
          'https://www.lego.com/nl-nl/product/the-lord-of-the-rings-rivendell-10316',
      },
    ]);
  });

  test('keeps Intertoys only where a verified direct product page is curated', () => {
    expect(
      listAffiliateOffers('76269').map(
        (affiliateOffer) => affiliateOffer.merchantId,
      ),
    ).toEqual(['intertoys', 'lego-nl']);

    expect(
      listAffiliateOffers('10333').map(
        (affiliateOffer) => affiliateOffer.merchantId,
      ),
    ).toEqual(['amazon-nl', 'lego-nl']);
  });

  test('expands direct reviewed merchant coverage for additional high-intent sets', () => {
    expect(
      listAffiliateOffers('76178').map((affiliateOffer) => ({
        merchantId: affiliateOffer.merchantId,
        outboundUrl: affiliateOffer.outboundUrl,
      })),
    ).toEqual([
      {
        merchantId: 'lego-nl',
        outboundUrl: 'https://www.lego.com/nl-nl/product/daily-bugle-76178',
      },
    ]);
  });

  test('adds reviewed multi-merchant coverage for the latest curated batch', () => {
    expect(
      listAffiliateOffers('10354').map((affiliateOffer) => ({
        merchantId: affiliateOffer.merchantId,
        outboundUrl: affiliateOffer.outboundUrl,
      })),
    ).toEqual([
      {
        merchantId: 'lego-nl',
        outboundUrl: 'https://www.lego.com/nl-nl/product/the-shire-10354',
      },
      {
        merchantId: 'amazon-nl',
        outboundUrl:
          'https://www.amazon.nl/Lego-Auenland-Shire-10354-bedrukte/dp/B0FZBDWLT5?__mk_nl_NL=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=2AWWZ6F0AIB5R&dib=eyJ2IjoiMSJ9.eND83uolzMdoK3sUq15eYkuQfwAn8CDgs6YaNtI9eWCHIACPWsiF5paTyoxcRavIi31ifYAw2fDy7ftR_ZDVasbYbyEjLxg4k-35XU_RXl1yR0ky6RZfW7vxff69Zd3Pf7FfgP7zlZBR1HrH0tXMYc0cPTAUXZEyWESlUdoG6iVPe6S93yP2kExoP-3hQlXdxoNwmP67PBFobI_UpIbKZfdHEx9uuZKYjUGxVVcXWBTV4F4DQxoRsb61qTkkJYsVHkYVuqJo9ilYITOkwOSJBtCqJ0rznDV-ANLn7T-4j-g.Y-u8TEHEU7iBgySW13nL6njKwJiAO9n8FXvih3_EofI&dib_tag=se&keywords=lego+The+Lord+of+the+Rings%3A+The+Shire&qid=1775758663&sprefix=lego+the+lord+of+the+rings+the+shire%2Caps%2C147&sr=8-1&linkCode=ll2&tag=brickhunt09-21&linkId=66add913149e68e57c56f2536d98d169&ref_=as_li_ss_tl',
      },
    ]);
  });

  test('returns no affiliate offers for sets outside the commerce slice', () => {
    expect(listAffiliateOffers('76419')).toEqual([]);
  });
});
