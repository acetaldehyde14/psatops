package com.psap.palletisation.repository;

import com.psap.palletisation.entity.IntegrationOrderEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;

public interface IntegrationOrderRepository extends JpaRepository<IntegrationOrderEntity, Long> {
    Optional<IntegrationOrderEntity> findByOrderId(String orderId);
    boolean existsByOrderId(String orderId);

    @Transactional
    void deleteByOrderId(String orderId);
}
