package mapaux

type StopCloseChan chan struct{}

func IsClosed(ch StopCloseChan) bool {
	select {
	case <-ch:
		return true
	default:
		return false
	}
}
