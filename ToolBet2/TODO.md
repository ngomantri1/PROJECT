# TODO

Chỉ giữ việc còn thiếu có bằng chứng. Không ghi changelog đã hoàn tất tại đây.

- [ ] Cài/khôi phục test runner trong môi trường build rồi chạy focused suite;
      hiện `.venv` thiếu `pytest`, nên chưa có kết quả test runtime mới.
- [ ] Chạy controlled browser session không tiền thật (`auto_bet=false` hoặc
      Simulation) để xác minh table selection, overlay recovery và countdown.
- [ ] Thu thập một lần `NO_ELIGIBLE_AUTHORITY` sau shoe transition trong runtime
      mới; log cũ không đủ field để kết luận nguyên nhân.
- [ ] Kiểm thử end-to-end placement/recovery multi-live với fixture hoặc môi
      trường stake-zero; unit coverage không thay thế bằng chứng casino thật.
- [ ] Xác minh restore license cache và lease heartbeat trên môi trường có
      endpoint hợp lệ; không dùng credential thật trong test.
- [ ] Nếu release nâng schema SQLite, tạo fixture DB cũ và kiểm tra migration
      additive trước khi phát hành.
