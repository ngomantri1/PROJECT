(function () {
  "use strict";

  function buildPayload(host) {
    if (typeof VIETQR === "undefined" || typeof qrcode === "undefined") {
      throw new Error("QR libraries not loaded");
    }

    var qrPayload = new VIETQR();
    qrPayload.fields.acq = (host.dataset.acq || "").trim();
    qrPayload.fields.merchant_id = (host.dataset.account || "").trim();
    qrPayload.fields.amount = String(host.dataset.amount || "").trim();
    qrPayload.fields.purpose_txn = (host.dataset.content || "").trim();
    qrPayload.fields.merchant_name = (host.dataset.accountName || "").trim();
    qrPayload.fields.merchant_city = "HANOI";
    qrPayload.fields.is_dynamic_qr = true;
    qrPayload.fields.service_code = SERVICE_CODE.TO_ACCOUNT;
    return qrPayload.builder();
  }

  function renderPaymentQr() {
    var host = document.getElementById("paymentQr");
    if (!host) {
      return;
    }

    try {
      var payload = buildPayload(host);
      var qr = qrcode(0, "M");
      qr.addData(payload, "Byte");
      qr.make();
      host.innerHTML = qr.createSvgTag({
        cellSize: 6,
        margin: 0,
        scalable: true,
        title: "Mã QR chuyển khoản cho đơn " + (host.dataset.orderCode || "")
      });
    } catch (error) {
      host.innerHTML = '<div class="payment-qr-loading">Không tạo được QR. Vui lòng dùng thông tin chuyển khoản bên dưới.</div>';
      console.error(error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderPaymentQr);
  } else {
    renderPaymentQr();
  }
})();
